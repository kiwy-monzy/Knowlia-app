// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Qaul Tauri Application
//!
//! External Tauri application for managing qaul groups and functionality

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use contextual_bandit::{manager as cb_manager, notifications};
// Use tauri with an alias to avoid conflict with local module
// Import Tauri types with explicit paths to avoid conflicts

extern crate tauri as tauri_crate;
use ::tauri_crate::{Manager, AppHandle, Emitter, Listener, LogicalPosition, Window, LogicalSize, State, WebviewWindowBuilder, WebviewUrl, Event, Builder, App, async_runtime};
use embedding::service::EmbeddingManager;
use llm::{mcp_client, mcp_server, LoycaServer};
use ocr::OcrManager;
use serde::{Deserialize, Serialize};
use serde_json;
use std::sync::{Arc, Mutex};
use screenshots::Screen;
use crate::commands::zotero::clear_zotero_cache;
use crate::commands::zotero::get_zotero_stats;
use crate::commands::zotero::delete_zotero_collection;
use crate::commands::zotero::update_zotero_collection;
use crate::commands::zotero::create_zotero_collection;
use crate::commands::zotero::delete_zotero_item;
use crate::commands::zotero::update_zotero_item;
use crate::commands::zotero::create_zotero_item;
use crate::commands::zotero::search_zotero_items;
use crate::commands::zotero::get_zotero_collections;
use crate::commands::zotero::get_collection_items;
use crate::commands::zotero::get_zotero_items;
use crate::commands::zotero::get_zotero_config;
use crate::commands::zotero::configure_zotero;
use crate::commands::zotero::init_zotero;
use crate::tauri::group::open_file;
use crate::commands::zotero::is_zotero_configured;
use crate::tauri::user::get_all_neighbours;
// Commands modules - uncomment when needed
 use commands::bolt::{confirm_verification, get_location_suggestions, start_verification};
use commands::gdrive::{
    download_drive_file, get_recorded_downloads_command, get_root_folders, open_storage_file,
    scan_downloads, scan_downloads_with_metadata, test_downloads_command,
};
use commands::zotero::ZoteroState;


mod embedding;
mod llm;
mod helpers;
mod sql;
mod constants;
mod contextual_bandit;
mod window_manager;
mod ocr;
mod background_tasks;
mod commands;
mod taxi_service;
mod timetable;
// Task module is now in tauri/task.rs

// Import qaul module
pub mod qaul_module;
pub mod modes;
 
// Import MEGA module if it exists
// use crate::qaul_module::mega; // Commented out as module doesn't exist
// Import individual command modules
// Note: All Tauri commands are now defined in src/tauri/ modules to avoid conflicts
use crate::tauri::user::{get_all_users, get_online_users, get_offline_users, user_profile, set_node_profile_tauri};
use crate::tauri::group::{create_group, create_direct_chat, get_or_create_direct_chat, get_group_info, get_group_list, rename_group, get_pending_invitations, get_new_message_id, invite_user_to_group, reply_to_group_invitation, remove_user_from_group, leave_group, get_messages, send_message, read_file_as_base64, delete_all_group_messages, delete_messages};
pub mod str0m;
pub mod tauri;
// Import qaul module functions
/// Result type for group operations
pub type GroupResult<T> = Result<T, String>;
use crate::tauri::task::*;
/// Tauri-friendly group information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInfo {
    pub group_id: Vec<u8>,
    pub group_name: String,
    pub created_at: u64,
    pub status: i32,
    pub revision: u32,
    pub is_direct_chat: bool,
    pub members: Vec<GroupMember>,
    pub unread_messages: u32,
    pub last_message_at: u64,
    pub last_message: Vec<u8>,
    pub last_message_sender_id: Vec<u8>,
}

/// Tauri-friendly group member structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMember {
    pub user_id: Vec<u8>,
    pub role: i32,
    pub joined_at: u64,
    pub state: i32,
    pub last_message_index: u32,
    pub name: String,
    pub reg_no: String,
    pub profile_pic: String,
    pub about: String,
    pub is_online: bool,
}

/// Application state
#[derive(Clone)]
pub struct AppState {
    pub task_store: Option<Arc<Mutex<TaskStore>>>,
    pub libqaul_initialized: Arc<Mutex<bool>>,
    pub current_user: Arc<Mutex<Option<String>>>,
    pub last_auth_check: Arc<Mutex<std::time::Instant>>,
}

impl AppState {
    pub fn new(task_store: Option<Arc<Mutex<TaskStore>>>) -> Self {
        Self {
            task_store,
            libqaul_initialized: Arc::new(Mutex::new(false)),
            current_user: Arc::new(Mutex::new(None)),
            last_auth_check: Arc::new(Mutex::new(std::time::Instant::now())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(None)
    }
}

// Conversion traits from protobuf to Tauri structures
impl From<libqaul::services::group::proto_rpc::GroupInfo> for GroupInfo {
    fn from(proto: libqaul::services::group::proto_rpc::GroupInfo) -> Self {
        Self {
            group_id: proto.group_id,
            group_name: proto.group_name,
            created_at: proto.created_at,
            status: proto.status,
            revision: proto.revision,
            is_direct_chat: proto.is_direct_chat,
            members: proto.members.into_iter().map(|m| m.into()).collect(),
            unread_messages: proto.unread_messages,
            last_message_at: proto.last_message_at,
            last_message: proto.last_message,
            last_message_sender_id: proto.last_message_sender_id,
        }
    }
}

impl From<libqaul::services::group::proto_rpc::GroupMember> for GroupMember {
    fn from(proto: libqaul::services::group::proto_rpc::GroupMember) -> Self {
        // Check if user is online by looking up in the routing table
        let is_online = if let Ok(peer_id) = libp2p::PeerId::from_bytes(&proto.user_id) {
            use libqaul::router::table::RoutingTable;
            use libqaul::utilities::qaul_id::QaulId;
            
            let q8id = QaulId::to_q8id(peer_id);
            RoutingTable::get_online_user_ids(0).contains(&q8id)
        } else {
            false
        };

        Self {
            user_id: proto.user_id,
            role: proto.role,
            joined_at: proto.joined_at,
            state: proto.state,
            last_message_index: proto.last_message_index,
            name: proto.name,
            reg_no: proto.reg_no,
            profile_pic: proto.profile_pic,
            about: proto.about,
            is_online,
        }
    }
}


#[tauri_crate::command]
async fn create_avatar_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Creating avatar window");
    let screens = Screen::all().map_err(|e| {
        let error_msg = format!("Failed to get screens: {}", e);
        tracing::error!("{}", error_msg);
        error_msg
    })?;
    let screen = screens.first().ok_or("No screens found")?;

    let avatar_width = 300.0;
    let avatar_height = 400.0;
    let margin = 20.0;

    // bottom right corner
    let x_position = screen.display_info.width as f64 - avatar_width - margin;
    let y_position = screen.display_info.height as f64 - avatar_height - margin;

    WebviewWindowBuilder::new(&app_handle, "avatar", WebviewUrl::App("/avatar".into()))
        .title("Avatar")
        .inner_size(avatar_width, avatar_height)
        .position(x_position, y_position)
        .resizable(true)
        .min_inner_size(200.0, 250.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .transparent(true)
        .shadow(false)
        .build()
        .map_err(|e| {
            let error_msg = format!("Failed to create avatar window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;
    tracing::info!(
        "Avatar window created successfully at position ({}, {})",
        x_position,
        y_position
    );
    Ok(())
}

#[tauri_crate::command]
async fn create_main_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Creating or focusing main window");
    // Check if main window already exists
    if let Some(main_window) = app_handle.get_webview_window("main") {
        // Window exists, just focus it
        main_window.set_focus().map_err(|e| {
            let error_msg = format!("Failed to focus main window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;
        tracing::info!("Main window focused successfully");
        return Ok(());
    }

    // Create new main window
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let screen = screens.first().ok_or("No screens found")?;

    let window_width = 1200.0;
    let window_height = 900.0;

    // Center the window
    let x_position = (screen.display_info.width as f64 - window_width) / 2.0;
    let y_position = (screen.display_info.height as f64 - window_height) / 2.0;

    WebviewWindowBuilder::new(&app_handle, "main", WebviewUrl::App("/".into()))
        .title("Knowly.ai - Configuration")
        .inner_size(window_width, window_height)
        .position(x_position, y_position)
        .resizable(true)
        .decorations(true)
        .always_on_top(false)
        .skip_taskbar(false)
        .transparent(false)
        .shadow(true)
        .build()
        .map_err(|e| {
            let error_msg = format!("Failed to create main window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;

    tracing::info!(
        "Main window created successfully at position ({}, {})",
        x_position,
        y_position
    );
    tracing::info!("Avatar window closed successfully");
    Ok(())
}

#[tauri_crate::command]
async fn close_app(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Closing application");
    // Close avatar window if it exists
    if let Some(avatar_window) = app_handle.get_webview_window("avatar") {
        avatar_window
            .close()
            .map_err(|e| format!("Failed to close avatar window: {}", e))?;
    }

    // Close main window if it exists
    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window
            .close()
            .map_err(|e| {
                let error_msg = format!("Failed to close main window: {}", e);
                tracing::error!("{}", error_msg);
                error_msg
            })?;
    }

    // Shutdown all MCP clients
    let mcp_manager = app_handle.state::<mcp_client::McpClientManager>();
    mcp_manager.shutdown_all().await;

    cb_manager::save_bandit_agent()?;

    tracing::info!("Application closed successfully");
    Ok(())
}

#[tauri_crate::command]
async fn close_avatar_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Closing avatar window");
    // Close avatar window if it exists
    if let Some(avatar_window) = app_handle.get_webview_window("avatar") {
        avatar_window
            .close()
            .map_err(|e| format!("Failed to close avatar window: {}", e))?;
    }
    Ok(())
}

#[tauri_crate::command]
async fn create_auth_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Creating auth window");
    
    // Check if auth window already exists
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        // Window exists, just show and focus it
        auth_window.show().map_err(|e| {
            let error_msg = format!("Failed to show auth window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;
        auth_window.set_focus().map_err(|e| {
            let error_msg = format!("Failed to focus auth window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;
        tracing::info!("Auth window shown and focused successfully");
        return Ok(());
    }

    let screens = Screen::all().map_err(|e| {
        let error_msg = format!("Failed to get screens: {}", e);
        tracing::error!("{}", error_msg);
        error_msg
    })?;
    let screen = screens.first().ok_or("No screens found")?;

    let auth_width = 800.0;
    let auth_height = 600.0;

    // Center the window
    let x_position = (screen.display_info.width as f64 - auth_width) / 2.0;
    let y_position = (screen.display_info.height as f64 - auth_height) / 2.0;

    let auth_window = WebviewWindowBuilder::new(&app_handle, "auth", WebviewUrl::External("https://lms.udsm.ac.tz/".parse().unwrap()))
        .title("LMS")
        .inner_size(auth_width, auth_height)
        .position(x_position, y_position)
        .resizable(true)
        .minimizable(true)
        .maximizable(true)
        .decorations(true)
        .shadow(false)
        .data_directory("shared_webview_data".into())
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| {
            let error_msg = format!("Failed to create auth window: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;

    // Inject CSS to hide scrollbars
    let css_injection = r#"
        <style>
            /* Hide scrollbars for all browsers */
            *::-webkit-scrollbar {
                display: none !important;
            }
            * {
                scrollbar-width: none !important; /* Firefox */
                -ms-overflow-style: none !important; /* Internet Explorer 10+ */
            }
            html {
            scroll-behavior: smooth;
            scroll-padding-top: 5rem;
            background: none;
            overflow: hidden;
            touch-action: pan-x pan-y;
            }
            html::-webkit-scrollbar, 
            body::-webkit-scrollbar {
                display: none !important;
            }
        </style>
    "#;

    auth_window.eval(&format!("document.head.insertAdjacentHTML('beforeend', `{}`);", css_injection))
        .map_err(|e| {
            let error_msg = format!("Failed to inject CSS to hide scrollbars: {}", e);
            tracing::error!("{}", error_msg);
            error_msg
        })?;
    
    tracing::info!(
        "Auth window created successfully at position ({}, {})",
        x_position,
        y_position
    );
    Ok(())
}

#[tauri_crate::command]
async fn close_auth_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Closing auth window");
    // Close auth window if it exists
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        auth_window
            .close()
            .map_err(|e| format!("Failed to close auth window: {}", e))?;
    }
    Ok(())
}

#[tauri_crate::command]
async fn toggle_auth_window(app_handle: AppHandle) -> Result<(), String> {
    tracing::info!("Toggling auth window");
    
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        // Window exists, close it
        auth_window
            .close()
            .map_err(|e| format!("Failed to close auth window: {}", e))?;
        tracing::info!("Auth window closed");
    } else {
        // Window doesn't exist, create it
        create_auth_window(app_handle).await?;
    }
    
    Ok(())
}

#[tauri_crate::command]
fn resize_avatar_window(width: f64, height: f64, window: Window) -> Result<(), String> {
    println!("resize_avatar_window called with: width={}, height={}", width, height);
    
    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;

    let current_pos = window
        .outer_position()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale_factor);

    let current_size = window
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale_factor);

    let right_edge = current_pos.x + current_size.width;
    let bottom_edge = current_pos.y + current_size.height;

    let new_pos = LogicalPosition {
        x: right_edge - width,
        y: bottom_edge - height,
    };

    let new_size = LogicalSize { width, height };

    println!("Setting new size: {:?} and position: {:?}", new_size, new_pos);

    window.set_size(new_size).map_err(|e| e.to_string())?;
    window.set_position(new_pos).map_err(|e| e.to_string())?;

    println!("Window resized successfully");

    Ok(())
}

/// Helper function to get current user (for internal use by plugins)
/// This is NOT a Tauri command - it's used by other Rust code
pub fn get_current_user_internal() -> Option<libqaul::node::user_accounts::UserAccount> {
    libqaul::node::user_accounts::UserAccounts::get_default_user()
}

/// Get current user ID (Tauri command for frontend)
#[tauri_crate::command]
async fn get_current_user_id(state: State<'_, AppState>) -> GroupResult<Option<String>> {
    let current_user = state.current_user.lock().unwrap();
    Ok(current_user.clone())
}

/// Get current user (Tauri command for frontend)
#[tauri_crate::command]
async fn get_current_user(state: State<'_, AppState>) -> GroupResult<Option<String>> {
    let current_user = state.current_user.lock().unwrap();
    Ok(current_user.clone())
}

/// Save sidebar collapse state
#[tauri_crate::command]
async fn stronghold_insert(_state: bool) -> Result<(), String> {
    // TODO: Implement state persistence
    Ok(())
}

/// Get platform information
#[tauri_crate::command]
async fn get_platform() -> Result<String, String> {
    Ok(std::env::consts::OS.to_string())
}

/// Alias for invite_user_to_group to match frontend call
#[tauri_crate::command]
async fn invite_to_group(group_id: String, user_id: String) -> Result<(), String> {
    // Delegate to the existing invite_user_to_group function
    invite_user_to_group(group_id, user_id).await
}

/// Get assignment count command
#[tauri_crate::command]
async fn get_assignment_count() -> Result<u32, String> {
    // TODO: Implement actual assignment counting logic
    // For now, return a placeholder value
    Ok(0)
}

/// Get enrolled course count command
#[tauri_crate::command]
async fn get_enrolled_course_count() -> Result<u32, String> {
    // TODO: Implement actual course counting logic
    // For now, return a placeholder value
    Ok(0)
}
#[tauri_crate::command]
async fn check_auth_window_storage(app_handle: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    // Test eval approach with existing auth window
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        // Test eval with dynamic key search
        let test_js = r#"
        (function() {
            // Search for OIDC keys dynamically
            const oidcKeyPatterns = ['oidc.user:https://login.udsm.ac.tz/oauth2/oidcdiscovery:', 'oidc.user:'];
            
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
                    const value = sessionStorage.getItem(key);
                    if (value && value.length > 50) {
                        console.log('Test eval found key:', key);
                        return 'found:' + key;
                    }
                }
            }
            return 'not_found';
        })()
        "#;
        
        match auth_window.eval(test_js) {
            Ok(result) => {
                tracing::info!("Test eval result: {:?}", result);
            },
            Err(e) => {
                tracing::warn!("Test eval failed: {}", e);
            }
        }
    }
    // Rate limiting: only allow auth check every 5 seconds
    {
        let mut last_check = state.last_auth_check.lock().unwrap();
        let now = std::time::Instant::now();
        if now.duration_since(*last_check) < std::time::Duration::from_secs(5) {
            tracing::debug!("Auth check rate limited - skipping");
            return Ok(true); // Assume still authenticated if recently checked
        }
        *last_check = now;
    }
    
    tracing::info!("Checking auth window storage with shared data directory");
    
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        use std::sync::mpsc;
        use std::sync::Arc;
        use std::sync::Mutex;
        
        let (tx, rx) = mpsc::channel();
        let tx = Arc::new(Mutex::new(Some(tx)));
        
        // Set up the listener BEFORE executing JavaScript
        let app_handle_clone = app_handle.clone();
        let tx_clone = tx.clone();
        let _listener = app_handle_clone.listen("auth_storage_check_result", move |event: Event| {
            if let Some(tx_guard) = tx_clone.lock().unwrap().take() {
                let payload = event.payload();
                let result = if payload == "true" { true } else { false };
                tracing::info!("Auth storage check result: {}", result);
                let _ = tx_guard.send(result);
            }
        });
        
        // Give the listener a moment to be registered
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        // Execute JavaScript in auth window that emits the result back
        let js_code = r#"
(function() {
    console.log('Checking auth storage in shared data directory');
    
    const oidcKeyPatterns = [
        'oidc.user:https://login.udsm.ac.tz/oauth2/oidcdiscovery:',
        'oidc.user:',
        'auth_token',
        'access_token',
        'session_token'
    ];
    
    // Check sessionStorage in auth window
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
            const value = sessionStorage.getItem(key);
            if (value) {
                try {
                    const oidcData = JSON.parse(value);
                    if (oidcData.access_token || oidcData.id_token) {
                        if (oidcData.expires_at) {
                            const currentTime = Math.floor(Date.now() / 1000);
                            const isValid = oidcData.expires_at > currentTime;
                            console.log('Found valid session token, expires at:', oidcData.expires_at, 'current:', currentTime, 'valid:', isValid);
                            window.__TAURI__.emit('auth_storage_check_result', isValid);
                            return;
                        }
                        console.log('Found session token without expiry');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    }
                } catch (error) {
                    // Check if it's a raw JWT token (not JSON format)
                    if (value.startsWith('ey') && value.includes('.')) {
                        console.log('Found raw JWT session token (valid format)');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    } else if (value.length > 10) {
                        console.log('Found non-JSON session token, treating as valid');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    }
                }
            }
        }
    }
    
    // Check localStorage in auth window
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
            const value = localStorage.getItem(key);
            if (value) {
                try {
                    const oidcData = JSON.parse(value);
                    if (oidcData.access_token || oidcData.id_token) {
                        if (oidcData.expires_at) {
                            const currentTime = Math.floor(Date.now() / 1000);
                            const isValid = oidcData.expires_at > currentTime;
                            console.log('Found valid local token, expires at:', oidcData.expires_at, 'current:', currentTime, 'valid:', isValid);
                            window.__TAURI__.emit('auth_storage_check_result', isValid);
                            return;
                        }
                        console.log('Found local token without expiry');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    }
                } catch (error) {
                    // Check if it's a raw JWT token (not JSON format)
                    if (value.startsWith('ey') && value.includes('.')) {
                        console.log('Found raw JWT local token (valid format)');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    } else if (value.length > 10) {
                        console.log('Found non-JSON local token, treating as valid');
                        window.__TAURI__.emit('auth_storage_check_result', true);
                        return;
                    }
                }
            }
        }
    }
    
    console.log('No valid authentication tokens found, checked sessionStorage and localStorage');
    window.__TAURI__.emit('auth_storage_check_result', false);
})()
"#;
        
        auth_window
            .eval(js_code)
            .map_err(|e| {
                let error_msg = format!("Failed to execute JavaScript in auth window: {}", e);
                tracing::error!("{}", error_msg);
                error_msg
            })?;
        
        // Wait for the result with a timeout
        match rx.recv_timeout(std::time::Duration::from_secs(5)) {
            Ok(result) => {
                tracing::info!("Auth storage check completed successfully: {}", result);
                Ok(result)
            },
            Err(_) => {
                // Timeout or error, assume not authenticated
                tracing::warn!("Auth storage check timeout - assuming not authenticated");
                Ok(false)
            }
        }
    } else {
        tracing::warn!("No auth window found for auth storage check");
        Ok(false)
    }
}

/// Get session data from auth window
#[tauri_crate::command]
async fn get_auth_session_data(app_handle: AppHandle) -> Result<Option<String>, String> {
    tracing::info!("Getting session data from auth window");
    
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        use std::sync::mpsc;
        use std::sync::Arc;
        use std::sync::Mutex;
        
        let (tx, rx) = mpsc::channel();
        let tx = Arc::new(Mutex::new(Some(tx)));
        
        // Set up the listener BEFORE executing JavaScript
        let app_handle_clone = app_handle.clone();
        let tx_clone = tx.clone();
        let _listener = app_handle_clone.listen("auth_session_data_result", move |event: Event| {
            if let Some(tx_guard) = tx_clone.lock().unwrap().take() {
                let payload = event.payload();
                tracing::info!("Session data received from auth window");
                let _ = tx_guard.send(payload.to_string());
            }
        });
        
        // Give the listener a moment to be registered
        std::thread::sleep(std::time::Duration::from_millis(10));
        
        // Execute JavaScript in auth window that emits the session data back
        let js_code = r#"
(function() {
    console.log('Getting session data from auth window');
    
    // Dynamic pattern matching for OIDC keys
    const oidcKeyPatterns = [
        'oidc.user:https://login.udsm.ac.tz/oauth2/oidcdiscovery:',
        'oidc.user:'
    ];
    
    // Search for the correct OIDC key in sessionStorage
    let sessionValue = null;
    let foundKey = null;
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
            const value = sessionStorage.getItem(key);
            if (value && value.length > 50) {
                try {
                    const oidcData = JSON.parse(value);
                    if (oidcData.access_token || oidcData.id_token || oidcData.refresh_token) {
                        sessionValue = value;
                        foundKey = key;
                        console.log('Found valid OIDC session key:', key);
                        break;
                    }
                } catch (error) {
                    // Check if it's a raw JWT token
                    if (value.startsWith('ey') && value.includes('.')) {
                        sessionValue = value;
                        foundKey = key;
                        console.log('Found raw JWT session key:', key);
                        break;
                    }
                }
            }
        }
    }
    
    if (sessionValue) {
        console.log('Found session data with key:', foundKey, ', sending to main window');
        window.__TAURI__.emit('auth_session_data_result', sessionValue);
    } else {
        console.log('No valid session data found in sessionStorage');
        window.__TAURI__.emit('auth_session_data_result', '');
    }
})()
"#;
        
        auth_window
            .eval(js_code)
            .map_err(|e| {
                let error_msg = format!("Failed to execute JavaScript in auth window: {}", e);
                tracing::error!("{}", error_msg);
                error_msg
            })?;
        
        // Wait for the result with a timeout
        match rx.recv_timeout(std::time::Duration::from_secs(3)) {
            Ok(result) => {
                if result.is_empty() {
                    tracing::info!("No session data found in auth window");
                    Ok(None)
                } else {
                    tracing::info!("Session data retrieved successfully from auth window");
                    Ok(Some(result))
                }
            },
            Err(_) => {
                // Timeout or error
                tracing::warn!("Session data retrieval timeout - assuming no session data");
                Ok(None)
            }
        }
    } else {
        tracing::warn!("No auth window found for session data retrieval");
        Ok(None)
    }
}

/// Get application data directory path
#[tauri_crate::command]
async fn get_app_path(app_handle: AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| {
        let error_msg = format!("Failed to get app directory: {}", e);
        tracing::error!("{}", error_msg);
        error_msg
    })?;
    Ok(app_dir.to_string_lossy().to_string())
}

#[tauri_crate::command]
async fn set_config_value(app_handle: AppHandle, key: &str, value: &str) -> Result<(), String> {
    crate::sql::main::set_config_value(key, value).map_err(|e| e.to_string())?;
    if key == "screenshot_delay"
        || key == "user_intention_delay"
        || key == "enable_background_tasks"
    {
        background_tasks::manage_background_tasks(app_handle.clone()).await?;
    }

    if key == "enable_background_tasks" && value == "true" {
        sql::queries::unfocus_current_app().ok(); // unfocus current app
    }

    app_handle.emit("set-config-value", ()).map_err(|e| {
        let error_msg = format!("Failed to emit set-config-value event: {}", e);
        tracing::error!("{}", error_msg);
        error_msg
    })?;
    let log_value = if key.contains("api_key") {
        let visible_chars = 5.min(value.len());
        format!(
            "{}{}",
            &value[..visible_chars],
            "*".repeat(value.len().saturating_sub(visible_chars))
        )
    } else {
        value.to_string()
    };
    tracing::info!("Set config value: {} = {}", key, log_value);
    Ok(())
}
// Tauri commands wrappers
#[tauri_crate::command]
async fn get_taxi_vehicles() -> Result<Vec<taxi_service::TaxiVehicle>, String> {
    taxi_service::taxi_vehicles::fetch_and_build_taxi_vehicles()
        .await
        .map_err(|e| e.to_string())
}


/// Background data sync service that runs periodically
async fn background_data_sync_service(app_handle: AppHandle) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
    let mut last_neighbors: Option<String> = None;
    
    loop {
        interval.tick().await;
        
        // Check for network updates
        let network_info = get_all_neighbours();
        let network_info_str = network_info.to_string();
        
        if last_neighbors.as_ref().map_or(true, |last| last != &network_info_str) {
            if let Err(e) = app_handle.emit("neighbors-updated", ()) {
                tracing::error!("Failed to emit neighbors-updated event: {}", e);
            }
            last_neighbors = Some(network_info_str);
        }
        
        // Fetch all users
        if let Ok(users_json) = get_all_users().await {
            if let Err(e) = app_handle.emit("users-updated", &users_json) {
                tracing::error!("Failed to emit users-updated event: {}", e);
            }
        } else {
            tracing::error!("Failed to fetch users in background service");
        }
        
        // Fetch all groups and serialize to JSON
        if let Ok(groups) = get_group_list().await {
            if let Ok(groups_json) = serde_json::to_string(&groups) {
                tracing::debug!("Groups JSON: {}", groups_json);
                if let Err(e) = app_handle.emit("groups-updated", &groups_json) {
                    tracing::error!("Failed to emit groups-updated event: {}", e);
                }
            } else {
                tracing::error!("Failed to serialize groups to JSON");
            }
        } else {
            tracing::error!("Failed to fetch groups in background service");
        }
        
        // Fetch pending invitations and serialize to JSON
        if let Ok(invitations) = get_pending_invitations().await {
            if let Ok(invitations_json) = serde_json::to_string(&invitations) {
                if let Err(e) = app_handle.emit("invitations-updated", &invitations_json) {
                    tracing::error!("Failed to emit invitations-updated event: {}", e);
                }
            } else {
                tracing::error!("Failed to serialize invitations to JSON");
            }
        } else {
            tracing::error!("Failed to fetch invitations in background service");
        }
        
        // Fetch taxi vehicles and emit update
        if let Ok(taxis) = get_taxi_vehicles().await {
            if let Ok(taxis_json) = serde_json::to_string(&taxis) {
                if let Err(e) = app_handle.emit("taxis-updated", &taxis_json) {
                    tracing::error!("Failed to emit taxis-updated event: {}", e);
                }
            } else {
                tracing::error!("Failed to serialize taxis to JSON");
            }
        } else {
            tracing::error!("Failed to fetch taxis in background service");
        }
    }
}

#[cfg_attr(mobile, mobile_entry_point)]
pub fn run() {


    log::info!("Initializing application...");

    // Create the application state with all required fields
    // Task store will be initialized in setup() where we have access to app data directory
    let app_state = AppState {
        task_store: None,
        libqaul_initialized: Arc::new(Mutex::new(false)),
        current_user: Arc::new(Mutex::new(None)),
        last_auth_check: Arc::new(Mutex::new(std::time::Instant::now())),
    };

    // Initialize session state
    let session_state = Arc::new(Mutex::new(std::collections::HashMap::<String, String>::new()));
    
    // Build the Tauri application
    Builder::default()
        .manage(session_state)
        .manage(EmbeddingManager::new())
        .manage(OcrManager::new())
        .manage(ZoteroState::new())
        .manage(app_state)
        .manage(timetable::DbState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_media::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_cache::init())
        .plugin(crate::tauri::qaul::init())
        .setup(|app: &mut App| {
            let app_handle = app.handle();
            let app_dir = app.path().app_data_dir()?;
            
            // Initialize database pool first, before any database operations
            sql::init(app)?;
            
            // Initialize task store (path is hardcoded in task.rs)
            match crate::tauri::task::init_task_store() {
                Ok(store) => {
                    log::info!("Task store initialized successfully");
                    app.manage(store);
                }
                Err(e) => {
                    log::error!("Failed to initialize task store: {}", e);
                }
            }
            
            // Initialize MEGA state
            app.manage(crate::tauri::mega::MegaState::default());
            
            // Initialize gdrive app handle for resource resolution
            commands::gdrive::init_app_handle(&app_handle);
            
            // Initialize embedding service
            let embedding_manager = app.state::<EmbeddingManager>();
            if let Err(e) = async_runtime::block_on(
                embedding_manager.initialize(app_handle.clone())
            ) {
                log::error!("Failed to initialize embedding service: {}", e);
            }
            sql::queries::delete_windows_info_older_than(3600 * 24).ok(); // Clear all info older than 1 day

            // Initialize bandit agent
            if let Err(e) = contextual_bandit::manager::initialize_bandit_agent() {
                log::error!("Failed to initialize bandit agent: {}", e);
            }
            let config_path = app_dir.join("mcp_config.json");
            let mcp_manager = mcp_client::McpClientManager::with_config_path(config_path);

            // Store the MCP client manager in app state
            app.manage(mcp_manager.clone());

            // Initialize MCP server manager
            let mcp_server_manager =
                Arc::new(mcp_server::McpServerManager::new(app.handle().clone()));
            app.manage(mcp_server_manager.clone());



            // Update Local Tools
            let loyca_server = LoycaServer::new(app.handle().clone());
            sql::queries::update_local_tools(loyca_server.list_tools(false))?;

            
            // Start background data sync service
            let app_handle_for_background = app.handle().clone();
            async_runtime::spawn(async move {
                background_data_sync_service(app_handle_for_background).await;
            });

            Ok(())
        })
        .invoke_handler(tauri_crate::generate_handler![
            //BOLT
            get_taxi_vehicles,
            start_verification,
            confirm_verification,
            get_location_suggestions,
            //GDRIVE
            get_root_folders,
            download_drive_file,
            open_file,
            scan_downloads,
            test_downloads_command,
            get_recorded_downloads_command,
            open_storage_file,
            scan_downloads_with_metadata,
            //AVATAR- KNOLY
            create_avatar_window,
            create_main_window,
            close_app,
            resize_avatar_window,
            close_avatar_window,
            //AUTH WINDOW
            create_auth_window,
            close_auth_window,
            toggle_auth_window,
            //KNOWLIA
            set_config_value,
            get_current_user_id,
            get_current_user,
            stronghold_insert,
            get_platform,
            get_app_path,
            get_assignment_count,
            get_enrolled_course_count,
            check_auth_window_storage,
            get_auth_session_data,
            get_all_users,
            get_online_users,
            get_offline_users,
            user_profile,
            set_node_profile_tauri,
            create_group,
            create_direct_chat,
            get_or_create_direct_chat,
            get_group_info,
            get_group_list,
            rename_group,
            get_pending_invitations,
            get_new_message_id,
            invite_user_to_group,
            invite_to_group,
            reply_to_group_invitation,
            remove_user_from_group,
            leave_group,
            get_messages,
            send_message,
            delete_messages,
            delete_all_group_messages,
            open_file,
            read_file_as_base64,
           // LLM chat
            llm::chat::get_all_sessions,
            llm::chat::get_session_messages,
            llm::chat::call_model,
            llm::chat::stop_model,
            llm::chat::validate_connection,
            // Testing purposes
            llm::image_analysis::take_screenshot,
            llm::user_intention::analyze_user_intention_command,
            llm::user_intention::get_user_intentions_command,
            llm::suggestions::generate_fake_suggestion,
            llm::suggestions::screenshots_context,
            // Semantic Search
            llm::local_tools::semantic_search_window_info,
            // Embedding service
            embedding::init_embedding_service,
            embedding::embedding_service_info,
            embedding::create_embedding,
            embedding::compute_text_similarity,
            embedding::compute_embedding_similarity,
            // OCR service
            ocr::init_ocr_service,
            ocr::ocr_service_info,
            ocr::process_image_from_url,
            ocr::take_screenshot_and_process,
            // window_manager
            window_manager::get_active_window_info,
            // sql
            sql::get_global_config,
            sql::get_window_info_by_pid,
            sql::get_window_info_by_pid_and_time,
            sql::get_all_apps,
            sql::get_apps_by_time_range,
            // background tasks
            background_tasks::init_background_task_manager,
            background_tasks::stop_all_background_tasks,
            background_tasks::manage_background_tasks,
            background_tasks::get_background_tasks_status,
            // contextual bandit
            cb_manager::get_choosen_arm_from_user_intention_id,
            cb_manager::get_bandit_stats,
            cb_manager::restart_contextual_bandit,
            notifications::send_notification,
            notifications::handle_notification_response,
            // MCP Client
            mcp_client::add_mcp_server,
            mcp_client::remove_mcp_server,
            mcp_client::list_mcp_servers,
            mcp_client::is_mcp_server_running,
            mcp_client::get_mcp_server_config,
            mcp_client::list_mcp_tools,
            mcp_client::update_tool_status,
            mcp_client::update_tool_status_by_server,
            // MCP Server
            mcp_server::start_mcp_server,
            mcp_server::stop_mcp_server,
            mcp_server::get_mcp_server_status,
            // RTC commands
            tauri::rtc::rtc_init,
            tauri::rtc::rtc_session_request,
            tauri::rtc::rtc_session_management,
            tauri::rtc::rtc_session_list,
            tauri::rtc::rtc_send_message,
            tauri::rtc::rtc_get_session,
            tauri::rtc::rtc_remove_session,
            tauri::rtc::rtc_get_pending_offer,
            tauri::rtc::rtc_get_sdp_answer,
            tauri::rtc::rtc_create_offer,
            tauri::rtc::rtc_create_answer,
            tauri::rtc::start_str0m_server,
            // TIMETABLE
            timetable::init_database,
            timetable::fetch_timetable_data,
            timetable::get_database_stats,
            timetable::get_all_events,
            timetable::refresh_timetable,
            timetable::scrape_timetable_data,
            // ZOTERO
            init_zotero,
            configure_zotero,
            get_zotero_config,
            is_zotero_configured,
            get_zotero_items,
            get_collection_items,
            get_zotero_collections,
            search_zotero_items,
            create_zotero_item,
            update_zotero_item,
            delete_zotero_item,
            create_zotero_collection,
            update_zotero_collection,
            delete_zotero_collection,
            clear_zotero_cache,
            get_zotero_stats,
            // MEGA commands commented out as module doesn't exist
            tauri::mega::mega_login,
            tauri::mega::mega_logout,
            tauri::mega::mega_get_tree_listing,
            tauri::mega::mega_get_cloud_drive,
            tauri::mega::mega_get_inbox,
            tauri::mega::mega_get_rubbish_bin,
            // Qaul commands
            crate::tauri::qaul::qaul_send_command,
            crate::tauri::qaul::get_internet_neighbours_ui_command,
            crate::tauri::qaul::get_all_neighbours_ui_command,
            crate::tauri::user::get_all_neighbours,
            crate::tauri::qaul::get_network_stats,
            // Task commands
            crate::tauri::task::create_task,
            crate::tauri::task::get_task,
            crate::tauri::task::update_task,
            crate::tauri::task::delete_task,
            crate::tauri::task::get_all_tasks,
            crate::tauri::task::get_tasks_by_status,
        ])
        .run(tauri_crate::generate_context!())
        .expect("error while running tauri application");
}