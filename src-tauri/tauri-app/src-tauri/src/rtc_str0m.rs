// Copyright (c) 2022 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # RTC str0m Integration
//!
//! Bridge between libqaul RTC session management and str0m WebRTC media handling

use std::collections::HashMap;
use std::sync::Arc;
use tauri::{command, AppHandle};
use str0m::{Rtc, Candidate};
use str0m::media::{MediaKind, Direction};
use str0m::net::Protocol;
use str0m::change::SdpOffer;
use serde::{Deserialize, Serialize};
use tokio::net::UdpSocket;
use tokio::sync::{mpsc, Mutex};

/// WebRTC session that combines libqaul session management with str0m media
#[derive(Debug, Clone)]
pub struct Str0mRtcSession {
    pub id: String,
    pub group_id: String,
    pub rtc_instance: Arc<Mutex<Rtc>>,
    pub is_initialized: bool,
}

/// WebRTC connection state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebRtcConnectionState {
    pub session_id: String,
    pub state: String, // "new", "connecting", "connected", "disconnected", "failed"
    pub local_sdp: Option<String>,
    pub remote_sdp: Option<String>,
    pub ice_candidates: Vec<String>,
}

/// WebRTC offer/answer for signaling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebRtcOffer {
    pub r#type: String,
    pub sdp: String,
    pub session_id: String,
}

/// Global RTC session manager
pub struct Str0mRtcManager {
    sessions: Arc<Mutex<HashMap<String, Str0mRtcSession>>>,
    udp_socket: Option<Arc<UdpSocket>>,
    event_sender: mpsc::UnboundedSender<String>,
}

impl Str0mRtcManager {
    pub fn new() -> Self {
        let (event_sender, mut event_receiver) = mpsc::unbounded_channel();
        let sessions = Arc::new(Mutex::new(HashMap::new()));
        
        // Start event processing loop
        let _sessions_clone = sessions.clone();
        tokio::spawn(async move {
            while let Some(event) = event_receiver.recv().await {
                log::info!("RTC Event: {}", event);
                // Process RTC events and emit to frontend
            }
        });
        
        Self {
            sessions,
            udp_socket: None,
            event_sender,
        }
    }
    
    pub async fn initialize(&mut self) -> Result<(), String> {
        // Bind UDP socket for WebRTC
        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
        
        let local_addr = socket.local_addr()
            .map_err(|e| format!("Failed to get local address: {}", e))?;
        
        self.udp_socket = Some(Arc::new(socket));
        
        log::info!("str0m RTC manager initialized on {}", local_addr);
        Ok(())
    }
    
    pub async fn create_session(&mut self, session_id: String, group_id: String) -> Result<String, String> {
        let mut rtc = Rtc::new();
        
        // Add local ICE candidate (UDP)
        if let Some(socket) = &self.udp_socket {
            let local_addr = socket.local_addr()
                .map_err(|e| format!("Failed to get local address: {}", e))?;
            
            let candidate = Candidate::host(local_addr, Protocol::Udp)
                .map_err(|e| format!("Failed to create ICE candidate: {}", e))?;
            
            rtc.add_local_candidate(candidate);
        }
        
        // Add media tracks
        let mut change = rtc.sdp_api();
        
        // Add audio track
        change.add_media(MediaKind::Audio, Direction::SendRecv, None, None);
        
        // Add video track
        change.add_media(MediaKind::Video, Direction::SendRecv, None, None);
        
        // Apply changes and get offer
        let (offer, _pending) = change.apply()
            .ok_or("Failed to create SDP offer")?;
        
        let session = Str0mRtcSession {
            id: session_id.clone(),
            group_id,
            rtc_instance: Arc::new(Mutex::new(rtc)),
            is_initialized: true,
        };
        
        self.sessions.lock().await.insert(session_id.clone(), session);
        
        // Return the SDP offer
        Ok(offer.to_string())
    }
    
    pub async fn accept_session(&mut self, session_id: String, offer_sdp: String) -> Result<String, String> {
        let sessions = self.sessions.lock().await;
        let session = sessions.get(&session_id)
            .ok_or("Session not found")?;
        
        let offer = SdpOffer::from_sdp_string(&offer_sdp)
            .map_err(|e| format!("Failed to parse SDP offer: {:?}", e))?;
        
        let mut rtc = session.rtc_instance.lock().await;
        let answer = rtc.sdp_api().accept_offer(offer)
            .map_err(|e| format!("Failed to accept SDP offer: {}", e))?;
        
        Ok(answer.to_string())
    }
    
    pub async fn get_session_state(&self, session_id: &str) -> Option<WebRtcConnectionState> {
        let sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(session_id) {
            let rtc = session.rtc_instance.lock().await;
            Some(WebRtcConnectionState {
                session_id: session_id.to_string(),
                state: format!("{:?}", rtc.is_connected()),
                local_sdp: None, // TODO: Get from str0m
                remote_sdp: None, // TODO: Get from str0m
                ice_candidates: vec![], // TODO: Get from str0m
            })
        } else {
            None
        }
    }
    
    pub async fn remove_session(&mut self, session_id: &str) {
        self.sessions.lock().await.remove(session_id);
    }
}

// Global manager instance
lazy_static::lazy_static! {
    static ref RTC_MANAGER: Arc<Mutex<Str0mRtcManager>> = Arc::new(Mutex::new(Str0mRtcManager::new()));
}

/// Initialize str0m RTC integration
#[command]
pub async fn rtc_str0m_init() -> Result<(), String> {
    {
        let mut manager = RTC_MANAGER.lock().await;
        manager.initialize().await?;
    }
    Ok(())
}

/// Create WebRTC session and return SDP offer
#[command]
pub async fn rtc_str0m_create_session(session_id: String, group_id: String) -> Result<String, String> {
    let mut manager = RTC_MANAGER.lock().await;
    let offer = manager.create_session(session_id, group_id).await?;
    Ok(offer)
}

/// Accept WebRTC session with SDP offer and return answer
#[command]
pub async fn rtc_str0m_accept_session(session_id: String, offer_sdp: String) -> Result<String, String> {
    let answer = {
        let mut manager = RTC_MANAGER.lock().await;
        manager.accept_session(session_id, offer_sdp).await?
    };
    Ok(answer)
}

/// Get WebRTC session state
#[command]
pub async fn rtc_str0m_get_state(session_id: String) -> Result<Option<WebRtcConnectionState>, String> {
    let state = {
        let manager = RTC_MANAGER.lock().await;
        manager.get_session_state(&session_id).await
    };
    Ok(state)
}

/// Handle WebRTC connection from frontend (bridges libqaul and str0m)
#[command]
pub async fn handle_webrtc_connection(offer: String) -> Result<WebRtcAnswer, String> {
    log::info!("Handling WebRTC connection with offer: {}", &offer[..100.min(offer.len())]);
    
    // Parse the offer - it might be a JSON object or plain SDP string
    let sdp_string = if offer.trim_start().starts_with('{') {
        // It's JSON, extract the SDP
        let offer_json: serde_json::Value = serde_json::from_str(&offer)
            .map_err(|e| format!("Failed to parse offer JSON: {}", e))?;
        
        offer_json.get("sdp")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'sdp' field in offer JSON")?
            .to_string()
    } else {
        // It's already a plain SDP string
        offer
    };
    
    // Create a new str0m RTC instance
    let mut rtc = Rtc::new();
    
    // Add local ICE candidate
    let addr = "127.0.0.1:5000".parse().unwrap();
    let candidate = Candidate::host(addr, Protocol::Udp)
        .map_err(|e| format!("Failed to create ICE candidate: {}", e))?;
    rtc.add_local_candidate(candidate);
    
    // Parse the offer and create answer using str0m's public API
    let parsed_offer = SdpOffer::from_sdp_string(&sdp_string)
        .map_err(|e| format!("Failed to parse SDP offer: {:?}", e))?;
    
    let answer = rtc.sdp_api().accept_offer(parsed_offer)
        .map_err(|e| format!("Failed to accept SDP offer: {}", e))?;
    
    // Convert to frontend format
    let web_rtc_answer = WebRtcAnswer {
        r#type: "answer".to_string(),
        sdp: answer.to_string(),
    };
    
    log::info!("Generated WebRTC answer");
    Ok(web_rtc_answer)
}

/// WebRTC answer structure for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebRtcAnswer {
    pub r#type: String,
    pub sdp: String,
}

/// Start str0m media server with libqaul integration
#[command]
pub async fn start_str0m_media_server(_app: AppHandle) -> Result<(), String> {
    log::info!("Starting str0m media server with libqaul integration");
    
    // Initialize RTC manager
    rtc_str0m_init().await?;
    
    // Set up event forwarding to frontend
    let _app_handle = _app.clone();
    tokio::spawn(async move {
        // Monitor RTC sessions and emit events
        loop {
            {
                let _manager = RTC_MANAGER.lock().await;
                // Check session states and emit events
                // TODO: Implement session monitoring
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });
    
    Ok(())
}
