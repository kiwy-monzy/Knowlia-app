//! RTC Session Management with str0m WebRTC Integration
//!
//! This module handles RTC session lifecycle including SDP offer/answer
//! exchange for WebRTC connections using the str0m library.

use super::Rtc;
use crate::{node::user_accounts::UserAccounts, utilities::timestamp};
use libp2p::PeerId;
use prost::Message;

pub struct RtcManaging {}

impl RtcManaging {
    /// Get list of all active RTC sessions
    pub fn session_list(_my_user_id: &PeerId) -> super::proto_rpc::RtcSessionListResponse {
        let mut res = super::proto_rpc::RtcSessionListResponse { sessions: vec![] };

        let sessions = super::RTCSESSIONS.get().read().unwrap();
        for (_id, session) in sessions.sessions.iter() {
            let entry = super::proto_rpc::RtcSession {
                group_id: session.group_id.clone(),
                session_type: session.session_type,
                state: session.state as u32,
                created_at: session.created_at,
                sdp_offer: session.sdp_offer.clone().unwrap_or_default(),
                sdp_answer: session.sdp_answer.clone().unwrap_or_default(),
            };
            res.sessions.push(entry);
        }
        res
    }

    /// Get a specific session by group_id, returns the session with SDP info
    pub fn get_session_with_sdp(group_id: &[u8]) -> Option<(super::RtcSession, Option<String>, Option<String>)> {
        if let Some(session) = super::Rtc::get_session_from_id(&group_id.to_vec()) {
            return Some((
                session.clone(),
                session.sdp_offer.clone(),
                session.sdp_answer.clone(),
            ));
        }
        None
    }

    /// Process session request from CLI/Tauri (caller initiates call with SDP offer)
    /// 
    /// # Arguments
    /// * `my_user_id` - The caller's peer ID
    /// * `req` - Request containing target peer ID, session type, and SDP offer
    /// 
    /// # Returns
    /// * `Ok(group_id)` - The session group ID on success
    /// * `Err(String)` - Error message on failure
    pub fn session_request(
        my_user_id: &PeerId,
        req: &super::proto_rpc::RtcSessionRequest,
    ) -> Result<Vec<u8>, String> {
        // Check if session already exists
        if let Some(_session) = super::Rtc::get_session_from_id(&req.group_id) {
            return Err("session already exists!".to_string());
        }

        // Validate SDP offer is provided
        let sdp_offer = if req.sdp_offer.is_empty() {
            None
        } else {
            Some(req.sdp_offer.clone())
        };

        // Insert new session entry with SDP offer
        let session = super::RtcSession {
            user_id: my_user_id.to_bytes(),
            group_id: req.group_id.clone(),
            session_type: req.session_type,
            state: 1, // Caller waiting for answer
            created_at: timestamp::Timestamp::get_timestamp(),
            sdp_offer: sdp_offer.clone(),
            sdp_answer: None,
        };
        super::Rtc::update_session(session);

        // Send session request message with SDP offer to the callee
        let proto_message = super::proto_net::RtcContainer {
            message: Some(super::proto_net::rtc_container::Message::RtcSessionRequest(
                super::proto_net::RtcSessionRequest {
                    session_type: req.session_type,
                    sdp_offer: sdp_offer.unwrap_or_default(),
                },
            )),
        };

        let mut message_buff = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut message_buff)
            .expect("Vec<u8> provides capacity as needed");

        if let Some(user_account) = UserAccounts::get_by_id(*my_user_id) {
            let receiver = PeerId::from_bytes(&req.group_id)
                .map_err(|e| format!("Invalid peer ID: {:?}", e))?;
            super::Rtc::send_rtc_message_through_message(&user_account, receiver, &message_buff);
        } else {
            return Err("user account has problem".to_string());
        }

        log::info!(
            "RTC session request sent to {} with session_type={}",
            bs58::encode(&req.group_id).into_string(),
            req.session_type
        );

        Ok(req.group_id.clone())
    }

    /// Send session management message with optional SDP answer
    fn send_session_management(
        my_user_id: &PeerId,
        group_id: &Vec<u8>,
        option: u32,
        sdp_answer: Option<String>,
    ) -> Result<bool, String> {
        // Send message with SDP answer (when accepting)
        let proto_message = super::proto_net::RtcContainer {
            message: Some(
                super::proto_net::rtc_container::Message::RtcSessionManagement(
                    super::proto_net::RtcSessionManagement {
                        option,
                        sdp_answer: sdp_answer.unwrap_or_default(),
                    },
                ),
            ),
        };

        let mut message_buff = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut message_buff)
            .expect("Vec<u8> provides capacity as needed");

        if let Some(user_account) = UserAccounts::get_by_id(*my_user_id) {
            let receiver = PeerId::from_bytes(group_id)
                .map_err(|e| format!("Invalid peer ID: {:?}", e))?;
            super::Rtc::send_rtc_message_through_message(&user_account, receiver, &message_buff);
        } else {
            return Err("user account has problem".to_string());
        }
        Ok(true)
    }

    /// Process session management request from CLI/Tauri (callee accepts/denies with SDP answer)
    /// 
    /// # Arguments
    /// * `my_user_id` - The callee's peer ID
    /// * `req` - Management request with option (1=accept, 2=deny, 3=end) and SDP answer
    /// 
    /// # Returns
    /// * `Ok(group_id)` - The session group ID on success
    /// * `Err(String)` - Error message on failure
    pub fn session_management(
        my_user_id: &PeerId,
        req: &super::proto_rpc::RtcSessionManagement,
    ) -> Result<Vec<u8>, String> {
        // Check if session exists
        match super::Rtc::get_session_from_id(&req.group_id) {
            Some(mut session) => {
                match req.option {
                    1 => {
                        // Accept call with SDP answer
                        let sdp_answer = if req.sdp_answer.is_empty() {
                            None
                        } else {
                            Some(req.sdp_answer.clone())
                        };

                        // Update session to established state with SDP answer
                        session.created_at = timestamp::Timestamp::get_timestamp();
                        session.state = 3; // Established
                        session.sdp_answer = sdp_answer.clone();
                        super::Rtc::update_session(session.clone());

                        // Send acceptance with SDP answer to caller
                        Self::send_session_management(
                            my_user_id,
                            &session.group_id.clone(),
                            req.option,
                            sdp_answer,
                        )?;

                        log::info!(
                            "RTC session accepted for {}",
                            bs58::encode(&session.group_id).into_string()
                        );
                    }
                    2 => {
                        // Decline call
                        super::Rtc::remove_session(&req.group_id);
                        Self::send_session_management(
                            my_user_id,
                            &session.group_id.clone(),
                            req.option,
                            None,
                        )?;
                        log::info!(
                            "RTC session declined for {}",
                            bs58::encode(&req.group_id).into_string()
                        );
                    }
                    3 => {
                        // End call
                        super::Rtc::remove_session(&req.group_id);
                        Self::send_session_management(
                            my_user_id,
                            &session.group_id.clone(),
                            req.option,
                            None,
                        )?;
                        log::info!(
                            "RTC session ended for {}",
                            bs58::encode(&req.group_id).into_string()
                        );
                    }
                    _ => {
                        return Err("unknown session management option".to_string());
                    }
                }
                Ok(session.group_id.clone())
            }
            None => Err("session does not exist!".to_string()),
        }
    }

    /// Process incoming session request from network (callee receives call with SDP offer)
    pub fn on_session_request(
        sender_id: &PeerId,
        receiver_id: &PeerId,
        req: &super::proto_net::RtcSessionRequest,
    ) {
        // Check if session already exists
        if let Some(_session) = super::Rtc::get_session_from_id(&sender_id.to_bytes()) {
            log::warn!("RTC session already exists for sender: {}", sender_id.to_base58());
            return;
        }

        // Parse SDP offer
        let sdp_offer = if req.sdp_offer.is_empty() {
            None
        } else {
            Some(req.sdp_offer.clone())
        };

        // Create new session entry with received SDP offer
        let session = super::RtcSession {
            user_id: receiver_id.to_bytes(),
            group_id: sender_id.to_bytes(),
            session_type: req.session_type,
            state: 2, // Received request (pending acceptance)
            created_at: timestamp::Timestamp::get_timestamp(),
            sdp_offer,
            sdp_answer: None,
        };
        super::Rtc::update_session(session);

        log::info!(
            "RTC session request received from {} (type: {})",
            sender_id.to_base58(),
            req.session_type
        );
    }

    /// Process incoming session management from network (caller receives answer)
    pub fn on_session_management(
        sender_id: &PeerId,
        _receiver_id: &PeerId,
        req: &super::proto_net::RtcSessionManagement,
    ) {
        match super::Rtc::get_session_from_id(&sender_id.to_bytes()) {
            Some(mut session) => {
                match req.option {
                    1 => {
                        // Caller receives acceptance with SDP answer
                        let sdp_answer = if req.sdp_answer.is_empty() {
                            None
                        } else {
                            Some(req.sdp_answer.clone())
                        };

                        session.state = 3; // Established
                        session.sdp_answer = sdp_answer;
                        session.created_at = timestamp::Timestamp::get_timestamp();
                        Rtc::update_session(session);

                        log::info!(
                            "RTC session established with {}",
                            sender_id.to_base58()
                        );
                    }
                    2 => {
                        // Call was declined
                        super::Rtc::remove_session(&sender_id.to_bytes());
                        log::info!(
                            "RTC session declined by {}",
                            sender_id.to_base58()
                        );
                    }
                    3 => {
                        // Call was ended
                        super::Rtc::remove_session(&sender_id.to_bytes());
                        log::info!(
                            "RTC session ended by {}",
                            sender_id.to_base58()
                        );
                    }
                    _ => {
                        log::error!("Unknown session management option: {}", req.option);
                    }
                }
            }
            None => {
                log::warn!(
                    "Session management received but session does not exist: {}",
                    sender_id.to_base58()
                );
            }
        }
    }

    /// Get the SDP offer for a pending incoming call (callee uses this to generate answer)
    pub fn get_pending_offer(group_id: &[u8]) -> Option<String> {
        if let Some(session) = super::Rtc::get_session_from_id(&group_id.to_vec()) {
            if session.state == 2 {
                // Only return offer for pending sessions
                return session.sdp_offer;
            }
        }
        None
    }

    /// Get the SDP answer for an established call (caller uses this to complete connection)
    pub fn get_sdp_answer(group_id: &[u8]) -> Option<String> {
        if let Some(session) = super::Rtc::get_session_from_id(&group_id.to_vec()) {
            if session.state == 3 {
                // Only return answer for established sessions
                return session.sdp_answer;
            }
        }
        None
    }
}
