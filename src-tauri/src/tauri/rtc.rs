// Copyright (c) 2022 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # RTC Tauri Commands with str0m WebRTC Integration
//!
//! Tauri command wrappers for qaul RTC functionality with proper
//! SDP offer/answer exchange for WebRTC connections using str0m.

use ::tauri::{command, AppHandle, Emitter};
use libqaul::services::rtc;
use libqaul::node::user_accounts::UserAccounts;
use serde::{Deserialize, Serialize};
use std::net::UdpSocket;
use std::sync::{Arc, RwLock};
use once_cell::sync::Lazy;

// Global str0m RTC instance for WebRTC connections
static STR0M_MANAGER: Lazy<RwLock<Option<Str0mManager>>> = Lazy::new(|| RwLock::new(None));

/// str0m WebRTC connection manager
pub struct Str0mManager {
    /// UDP socket for WebRTC traffic
    pub socket: Arc<UdpSocket>,
    /// Local address for ICE candidates
    pub local_addr: std::net::SocketAddr,
}

impl Str0mManager {
    /// Create a new str0m manager with a bound UDP socket
    pub fn new() -> Result<Self, String> {
        let host_addr = crate::str0m::util::select_host_address();
        let socket = UdpSocket::bind(format!("{}:0", host_addr))
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
        let local_addr = socket.local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;
        
        log::info!("str0m manager initialized on {}", local_addr);
        
        Ok(Self {
            socket: Arc::new(socket),
            local_addr,
        })
    }

    /// Generate an SDP offer for initiating a call
    pub fn create_offer(&self, session_type: u32) -> Result<String, String> {
        use str0m::Rtc;
        use str0m::Candidate;
        use str0m::media::Direction;
        
        let mut rtc = Rtc::builder().build();
        
        // Add local ICE candidate
        let candidate = Candidate::host(self.local_addr, "udp")
            .map_err(|e| format!("Failed to create ICE candidate: {:?}", e))?;
        rtc.add_local_candidate(candidate);
        
        // Add media based on session type
        let mut sdp_api = rtc.sdp_api();
        
        match session_type {
            1 => {
                // Audio only
                sdp_api.add_media(str0m::media::MediaKind::Audio, Direction::SendRecv, None, None, None);
            }
            2 => {
                // Video call (audio + video)
                sdp_api.add_media(str0m::media::MediaKind::Audio, Direction::SendRecv, None, None, None);
                sdp_api.add_media(str0m::media::MediaKind::Video, Direction::SendRecv, None, None, None);
            }
            3 => {
                // Screen share (video only, send only)
                sdp_api.add_media(str0m::media::MediaKind::Video, Direction::SendOnly, None, None, None);
            }
            _ => {
                return Err(format!("Unknown session type: {}", session_type));
            }
        }
        
        // Create and add data channel for signaling
        sdp_api.add_channel("signaling".to_string());
        
        // Generate offer
        let (offer, _pending) = sdp_api.apply()
            .ok_or("Failed to apply SDP changes")?;
        
        // Serialize offer to JSON
        let offer_json = serde_json::to_string(&offer)
            .map_err(|e| format!("Failed to serialize SDP offer: {}", e))?;
        
        log::info!("Created SDP offer for session_type={}", session_type);
        
        Ok(offer_json)
    }

    /// Process an SDP offer and generate an answer (for callee)
    pub fn create_answer(&self, offer_json: &str) -> Result<String, String> {
        use str0m::Rtc;
        use str0m::Candidate;
        use str0m::change::SdpOffer;
        
        // Parse the incoming offer
        let offer: SdpOffer = serde_json::from_str(offer_json)
            .map_err(|e| format!("Failed to parse SDP offer: {}", e))?;
        
        let mut rtc = Rtc::builder().build();
        
        // Add local ICE candidate
        let candidate = Candidate::host(self.local_addr, "udp")
            .map_err(|e| format!("Failed to create ICE candidate: {:?}", e))?;
        rtc.add_local_candidate(candidate);
        
        // Accept the offer and generate answer
        let answer = rtc.sdp_api()
            .accept_offer(offer)
            .map_err(|e| format!("Failed to accept offer: {:?}", e))?;
        
        // Serialize answer to JSON
        let answer_json = serde_json::to_string(&answer)
            .map_err(|e| format!("Failed to serialize SDP answer: {}", e))?;
        
        log::info!("Created SDP answer");
        
        Ok(answer_json)
    }
}

/// RTC session information for frontend (with SDP data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionInfo {
    pub group_id: String,
    pub session_type: u32,
    pub state: u32,
    pub created_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdp_offer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdp_answer: Option<String>,
}

/// RTC message content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcMessage {
    pub group_id: String,
    pub content: Vec<u8>,
    pub message_type: String, // "audio", "video", "chat"
}

/// RTC session request (caller initiates with optional SDP offer)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionRequest {
    pub group_id: String,
    pub session_type: u32, // 1: audio, 2: video, 3: screen share
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdp_offer: Option<String>, // If not provided, one will be generated
}

/// RTC session management (callee responds with SDP answer)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionManagement {
    pub group_id: String,
    pub option: u32, // 1: accept (with answer), 2: deny, 3: end
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdp_answer: Option<String>, // If not provided when accepting, one will be generated
}

/// Initialize RTC module and str0m manager
#[command]
pub async fn rtc_init() -> Result<(), String> {
    rtc::Rtc::init();
    
    // Initialize str0m manager
    let manager = Str0mManager::new()?;
    *STR0M_MANAGER.write().unwrap() = Some(manager);
    
    log::info!("RTC module and str0m manager initialized");
    Ok(())
}

/// Start RTC session request (caller initiates call with SDP offer)
/// 
/// This generates an SDP offer using str0m and sends it to the callee.
/// The offer is stored in the session so the callee can generate an answer.
#[command]
pub async fn rtc_session_request(request: RtcSessionRequest) -> Result<RtcSessionInfo, String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Convert group_id string to bytes
    let group_id_bytes = parse_peer_id(&request.group_id)?;
    
    // Get or generate SDP offer
    let sdp_offer = if let Some(offer) = request.sdp_offer {
        offer
    } else {
        // Generate offer using str0m
        let manager = STR0M_MANAGER.read().unwrap();
        let manager = manager.as_ref().ok_or("str0m manager not initialized. Call rtc_init first.")?;
        manager.create_offer(request.session_type)?
    };
    
    // Create session request with SDP offer
    let proto_request = rtc::proto_rpc::RtcSessionRequest {
        group_id: group_id_bytes.clone(),
        session_type: request.session_type,
        sdp_offer: sdp_offer.clone(),
    };
    
    // Send request
    let session_id = rtc::rtc_managing::RtcManaging::session_request(
        &user_account.id,
        &proto_request,
    )?;
    
    log::info!("RTC session request sent to {}", request.group_id);
    
    Ok(RtcSessionInfo {
        group_id: bs58::encode(&session_id).into_string(),
        session_type: request.session_type,
        state: 1, // Caller waiting
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        sdp_offer: Some(sdp_offer),
        sdp_answer: None,
    })
}

/// Accept/deny/end RTC session (callee responds with SDP answer when accepting)
/// 
/// When accepting (option=1), this generates an SDP answer from the stored offer
/// and sends it back to the caller to complete the WebRTC connection.
#[command]
pub async fn rtc_session_management(management: RtcSessionManagement) -> Result<RtcSessionInfo, String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Convert group_id string to bytes
    let group_id_bytes = parse_peer_id(&management.group_id)?;
    
    // Get the session to access the SDP offer
    let session = rtc::Rtc::get_session_from_id(&group_id_bytes)
        .ok_or("Session not found")?;
    
    let sdp_answer = if management.option == 1 {
        // Accepting - generate or use provided SDP answer
        if let Some(answer) = management.sdp_answer {
            Some(answer)
        } else if let Some(ref offer) = session.sdp_offer {
            // Generate answer from the stored offer using str0m
            let manager = STR0M_MANAGER.read().unwrap();
            let manager = manager.as_ref().ok_or("str0m manager not initialized. Call rtc_init first.")?;
            Some(manager.create_answer(offer)?)
        } else {
            return Err("No SDP offer available to create answer from".to_string());
        }
    } else {
        None
    };
    
    // Create management request with SDP answer
    let proto_management = rtc::proto_rpc::RtcSessionManagement {
        group_id: group_id_bytes.clone(),
        option: management.option,
        sdp_answer: sdp_answer.clone().unwrap_or_default(),
    };
    
    // Send management command
    let session_id = rtc::rtc_managing::RtcManaging::session_management(
        &user_account.id,
        &proto_management,
    )?;
    
    let new_state = match management.option {
        1 => 3, // Established
        2 | 3 => 0, // Ended/Declined
        _ => session.state as u32,
    };
    
    log::info!("RTC session management: option={}, group_id={}", management.option, management.group_id);
    
    Ok(RtcSessionInfo {
        group_id: bs58::encode(&session_id).into_string(),
        session_type: session.session_type,
        state: new_state,
        created_at: session.created_at,
        sdp_offer: session.sdp_offer,
        sdp_answer,
    })
}

/// Get list of active RTC sessions with SDP info
#[command]
pub async fn rtc_session_list() -> Result<Vec<RtcSessionInfo>, String> {
    // Get current user
    let _user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Get session list from storage
    let sessions_storage = rtc::RTCSESSIONS.get().read().unwrap();
    
    // Convert to frontend format with SDP info
    let mut result = Vec::new();
    for (_id, session) in sessions_storage.sessions.iter() {
        result.push(RtcSessionInfo {
            group_id: bs58::encode(&session.group_id).into_string(),
            session_type: session.session_type,
            state: session.state as u32,
            created_at: session.created_at,
            sdp_offer: session.sdp_offer.clone(),
            sdp_answer: session.sdp_answer.clone(),
        });
    }
    
    Ok(result)
}

/// Get pending SDP offer for an incoming call (callee uses this to see the offer)
#[command]
pub async fn rtc_get_pending_offer(group_id: String) -> Result<Option<String>, String> {
    let group_id_bytes = parse_peer_id(&group_id)?;
    Ok(rtc::rtc_managing::RtcManaging::get_pending_offer(&group_id_bytes))
}

/// Get SDP answer for an established call (caller uses this to complete connection)
#[command]
pub async fn rtc_get_sdp_answer(group_id: String) -> Result<Option<String>, String> {
    let group_id_bytes = parse_peer_id(&group_id)?;
    Ok(rtc::rtc_managing::RtcManaging::get_sdp_answer(&group_id_bytes))
}

/// Send RTC message (audio/video/chat)
#[command]
pub async fn rtc_send_message(message: RtcMessage) -> Result<(), String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    let group_id_bytes = parse_peer_id(&message.group_id)?;
    
    // Create outgoing message
    let proto_message = rtc::proto_rpc::RtcOutgoing {
        group_id: group_id_bytes,
        content: message.content,
    };
    
    // Send message
    rtc::rtc_messaging::RtcMessaging::send_message(&user_account.id, &proto_message)?;
    
    Ok(())
}

/// Get RTC session by ID with full SDP info
#[command]
pub async fn rtc_get_session(group_id: String) -> Result<Option<RtcSessionInfo>, String> {
    let group_id_bytes = parse_peer_id(&group_id)?;
    
    match rtc::Rtc::get_session_from_id(&group_id_bytes) {
        Some(session) => Ok(Some(RtcSessionInfo {
            group_id: bs58::encode(&session.group_id).into_string(),
            session_type: session.session_type,
            state: session.state as u32,
            created_at: session.created_at,
            sdp_offer: session.sdp_offer,
            sdp_answer: session.sdp_answer,
        })),
        None => Ok(None),
    }
}

/// Remove RTC session
#[command]
pub async fn rtc_remove_session(group_id: String) -> Result<(), String> {
    let group_id_bytes = parse_peer_id(&group_id)?;
    rtc::Rtc::remove_session(&group_id_bytes);
    Ok(())
}

/// Generate SDP offer for a specific session type (utility for frontend)
#[command]
pub async fn rtc_create_offer(session_type: u32) -> Result<String, String> {
    let manager = STR0M_MANAGER.read().unwrap();
    let manager = manager.as_ref().ok_or("str0m manager not initialized. Call rtc_init first.")?;
    manager.create_offer(session_type)
}

/// Generate SDP answer from an offer (utility for frontend)
#[command]
pub async fn rtc_create_answer(sdp_offer: String) -> Result<String, String> {
    let manager = STR0M_MANAGER.read().unwrap();
    let manager = manager.as_ref().ok_or("str0m manager not initialized. Call rtc_init first.")?;
    manager.create_answer(&sdp_offer)
}

/// Helper function to parse peer ID from string
fn parse_peer_id(id_str: &str) -> Result<Vec<u8>, String> {
    if id_str.starts_with("0x") || id_str.chars().all(|c| c.is_ascii_hexdigit()) {
        hex::decode(id_str)
            .map_err(|e| format!("Invalid hex peer ID: {}", e))
    } else {
        bs58::decode(id_str)
            .into_vec()
            .map_err(|e| format!("Invalid base58 peer ID: {}", e))
    }
}

// === Event Emission Functions ===

/// Listen for RTC events and emit to frontend
pub fn setup_rtc_event_listeners(app_handle: AppHandle) {
    let _app_handle_clone = app_handle.clone();
    log::info!("RTC event listeners setup completed");
}

/// Emit RTC session event to frontend
pub fn emit_rtc_event(app_handle: &AppHandle, event: &str, session: &RtcSessionInfo) {
    if let Err(e) = app_handle.emit(event, session) {
        log::error!("Failed to emit RTC event {}: {}", event, e);
    }
}

/// Emit RTC incoming call event
pub fn emit_incoming_call(app_handle: &AppHandle, session: &RtcSessionInfo) {
    if let Err(e) = app_handle.emit("rtc-incoming-call", session) {
        log::error!("Failed to emit incoming call event: {}", e);
    }
}

/// Emit RTC session established event
pub fn emit_session_established(app_handle: &AppHandle, session: &RtcSessionInfo) {
    if let Err(e) = app_handle.emit("rtc-session-established", session) {
        log::error!("Failed to emit session established event: {}", e);
    }
}

/// Emit RTC session ended event
pub fn emit_session_ended(app_handle: &AppHandle, session: &RtcSessionInfo) {
    if let Err(e) = app_handle.emit("rtc-session-ended", session) {
        log::error!("Failed to emit session ended event: {}", e);
    }
}

/// Start str0m HTTP signaling server (for browser-based WebRTC)
#[command]
pub async fn start_str0m_server(app: AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        crate::str0m::chat::main(&app);
    });
    Ok(())
}
