// Copyright (c) 2022 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # RTC Tauri Commands
//!
//! Tauri command wrappers for qaul RTC functionality

use tauri::{command, AppHandle, Emitter};
use libqaul::services::rtc;
use libqaul::node::user_accounts::UserAccounts;
use serde::{Deserialize, Serialize};

/// RTC session information for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionInfo {
    pub group_id: String,
    pub session_type: u32,
    pub state: u32,
    pub created_at: u64,
}

/// RTC message content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcMessage {
    pub group_id: String,
    pub content: Vec<u8>,
    pub message_type: String, // "audio", "video", "chat"
}

/// RTC session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionRequest {
    pub group_id: String,
    pub session_type: u32, // 1: audio, 2: video, 3: discussion
}

/// RTC session management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtcSessionManagement {
    pub group_id: String,
    pub option: u32, // 1: accept, 2: deny, 3: end
}

/// Initialize RTC module
#[command]
pub async fn rtc_init() -> Result<(), String> {
    rtc::Rtc::init();
    Ok(())
}

/// Start RTC session request
#[command]
pub async fn rtc_session_request(request: RtcSessionRequest) -> Result<String, String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Convert group_id string to bytes
    let group_id_bytes = bs58::decode(request.group_id.clone())
        .into_vec()
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    // Create session request
    let proto_request = rtc::proto_rpc::RtcSessionRequest {
        group_id: group_id_bytes.clone(),
        session_type: request.session_type,
    };
    
    // Send request
    let session_id = rtc::rtc_managing::RtcManaging::session_request(
        &user_account.id,
        &proto_request,
    )?;
    
    Ok(bs58::encode(session_id).into_string())
}

/// Accept/deny/end RTC session
#[command]
pub async fn rtc_session_management(management: RtcSessionManagement) -> Result<String, String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Convert group_id string to bytes
    let group_id_bytes = bs58::decode(management.group_id.clone())
        .into_vec()
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    // Create management request
    let proto_management = rtc::proto_rpc::RtcSessionManagement {
        group_id: group_id_bytes,
        option: management.option,
    };
    
    // Send management command
    let session_id = rtc::rtc_managing::RtcManaging::session_management(
        &user_account.id,
        &proto_management,
    )?;
    
    Ok(bs58::encode(session_id).into_string())
}

/// Get list of active RTC sessions
#[command]
pub async fn rtc_session_list() -> Result<Vec<RtcSessionInfo>, String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Get session list
    let sessions = rtc::rtc_managing::RtcManaging::session_list(&user_account.id);
    
    // Convert to frontend format
    let mut result = Vec::new();
    for session in sessions.sessions {
        result.push(RtcSessionInfo {
            group_id: bs58::encode(session.group_id).into_string(),
            session_type: session.session_type,
            state: session.state,
            created_at: session.created_at,
        });
    }
    
    Ok(result)
}

/// Send RTC message (audio/video/chat)
#[command]
pub async fn rtc_send_message(message: RtcMessage) -> Result<(), String> {
    // Get current user
    let user_account = UserAccounts::get_default_user()
        .ok_or("No user account found")?;
    
    // Convert group_id string to bytes
    let group_id_bytes = bs58::decode(message.group_id)
        .into_vec()
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    // Create outgoing message
    let proto_message = rtc::proto_rpc::RtcOutgoing {
        group_id: group_id_bytes,
        content: message.content,
    };
    
    // Send message
    rtc::rtc_messaging::RtcMessaging::send_message(&user_account.id, &proto_message)?;
    
    Ok(())
}

/// Get RTC session by ID
#[command]
pub async fn rtc_get_session(group_id: String) -> Result<Option<RtcSessionInfo>, String> {
    // Convert group_id string to bytes
    let group_id_bytes = bs58::decode(group_id)
        .into_vec()
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    // Get session
    match rtc::Rtc::get_session_from_id(&group_id_bytes) {
        Some(session) => Ok(Some(RtcSessionInfo {
            group_id: bs58::encode(session.group_id).into_string(),
            session_type: session.session_type,
            state: session.state as u32,
            created_at: session.created_at,
        })),
        None => Ok(None),
    }
}

/// Remove RTC session
#[command]
pub async fn rtc_remove_session(group_id: String) -> Result<(), String> {
    // Convert group_id string to bytes
    let group_id_bytes = bs58::decode(group_id)
        .into_vec()
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    // Remove session
    rtc::Rtc::remove_session(&group_id_bytes);
    
    Ok(())
}

/// Listen for RTC events and emit to frontend
pub fn setup_rtc_event_listeners(app_handle: AppHandle) {
    // Set up a background task to monitor RTC session changes
    let _app_handle_clone = app_handle.clone();
    
    // In a real implementation, this would listen for RTC events from libqaul
    // and emit them to the frontend using Tauri's event system
    // For now, we'll emit events when session state changes occur
    
    println!("RTC event listeners setup completed");
    
    // This function should be called whenever RTC sessions are created/updated/deleted
    // to emit events to the frontend
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

/// Start str0m HTTP signaling server
#[command]
pub async fn start_str0m_server(_app: AppHandle) -> Result<(), String> {
    // TODO: Implement str0m server integration
    // This should start a WebRTC signaling server that bridges with libqaul
    log::info!("str0m server start requested (not yet implemented)");
    Ok(())
}
