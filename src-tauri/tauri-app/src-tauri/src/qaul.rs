use tauri::{plugin::{Builder, TauriPlugin}, AppHandle, Runtime, Emitter, Manager, Listener};
use std::sync::Arc;
use tauri_plugin_notification::NotificationExt;

use crate::modes::{user_accounts::UserAccounts, rpc::Rpc};

/// Information about an internet neighbour for UI consumption
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InternetNeighbourInfo {
    /// Peer ID as bytes
    pub peer_id: Vec<u8>,
    /// Address of the peer
    pub address: String,
    /// Name of the peer
    pub name: String,
    /// Online status
    pub online: bool,
    /// Round trip time in milliseconds
    pub rtt_ms: Option<u32>,
}

/// Set the global event emitter for libqaul events
pub fn set_tauri_event_emitter(emitter: std::sync::Arc<dyn Fn(String, serde_json::Value) + Send + Sync>) {
    libqaul::connections::events::set_event_emitter(emitter);
}

/// Optional: expose a command so frontend can send CLI-like commands
#[tauri::command]
pub async fn qaul_send_command(command: String) -> Result<String, String> {
    // Process the command using existing CLI infrastructure
    crate::modes::cli::Cli::process_command(command.clone());
    Ok(format!("Command processed: {}", command))
}

/// Get internet neighbours information for UI
#[tauri::command]
pub fn get_internet_neighbours_ui_command() -> Result<Vec<InternetNeighbourInfo>, String> {
    Ok(get_internet_neighbours_ui())
}

/// Public init function – used from main.rs
pub fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("qaul")
        .invoke_handler(tauri::generate_handler![qaul_send_command, get_internet_neighbours_ui_command])
        .setup(|app_handle, _| {
            let app = app_handle.clone();

            // Set up the event emitter for libqaul events
            let app_clone = app_handle.clone();
            let emitter = Arc::new(move |event_name: String, payload: serde_json::Value| {
                let app = app_clone.clone();
                let event_name = event_name.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = app.emit(&event_name, &payload) {
                        eprintln!("Failed to emit {} event: {}", event_name, e);
                    }
                });
            });

            // Set the global event emitter in libqaul
            set_tauri_event_emitter(emitter);

            // Set up message received event listener for notifications
            let app_for_events = app_handle.clone();
            app_handle.listen("message-received", move |event| {
                let payload = event.payload();
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(payload) {
                    if let Some(content) = data.get("content").and_then(|v| v.as_str()) {
                        if let Some(sender_id) = data.get("sender_id").and_then(|v| v.as_str()) {
                            // Clone the values to move into async closure
                            let content = content.to_string();
                            let sender_id = sender_id.to_string();
                            
                            // Show notification for incoming message
                            let app = app_for_events.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = show_message_notification(&app, &sender_id, &content).await {
                                    eprintln!("Failed to show notification: {}", e);
                                }
                            });
                        }
                    }
                }
            });

            // Set up RTC event listeners for active sessions
            crate::rtc::setup_rtc_event_listeners(app_handle.clone());

            // Start libqaul in background – no stdio, no waiting for input
            tauri::async_runtime::spawn(async move {
                start_qaul_node(&app).await;
            });


            Ok(())
        })
        .build()
}


/// Show notification for incoming message
async fn show_message_notification<R: Runtime>(app: &AppHandle<R>, sender_id: &str, content: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Try to get sender name from user accounts
    let sender_name = if let Some(sender_bytes) = bs58::decode(sender_id).into_vec().ok() {
        if let Ok(peer_id) = libp2p::PeerId::from_bytes(&sender_bytes) {
            if let Some(user_account) = libqaul::node::user_accounts::UserAccounts::get_by_id(peer_id) {
                user_account.name
            } else {
                format!("User ({})", &sender_id[..8])
            }
        } else {
            format!("User ({})", &sender_id[..8])
        }
    } else {
        format!("User ({})", &sender_id[..8])
    };

    // Truncate message content if too long
    let message_preview = if content.len() > 50 {
        format!("{}...", &content[..47])
    } else {
        content.to_string()
    };

    // Show notification using the simpler API
    app.notification()
        .builder()
        .title(format!("New message from {}", sender_name))
        .body(message_preview)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;

    Ok(())
}

async fn start_qaul_node<R: Runtime>(app: &AppHandle<R>) {
    // Get proper cross-platform storage path (C:\Users\PC\AppData\Local\YourApp on Windows)
    let storage_path = app
        .path()
        .app_local_data_dir()
        .expect("Failed to resolve app data dir")
        .to_string_lossy()
        .to_string();
    // assert!(kill(3030).expect(""));
    let config: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
    //config.insert("port".to_string(), "3030".to_string());

    // Start libqaul silently
    libqaul::api::start_with_config(storage_path, Some(config));
    //libqaul::api::start_with_config(storage_path, None);

    // Wait for node to be ready
    while !libqaul::api::initialization_finished() {
        async_std::task::sleep(std::time::Duration::from_millis(10)).await;
    }

    // initialize user accounts
    UserAccounts::init();
    // Create default user if none exists
    if libqaul::node::user_accounts::UserAccounts::len() == 0 {
       let _ = libqaul::node::user_accounts::UserAccounts::create(
           "WebrtcActive".to_string(),
           None, // profile_pic
           None, // about  
           None, // reg_no
           None, // college
       );
    }


    // Main event loop – only processes incoming RPC from libqaul
    // No stdin, no ticker spam, no println!
    loop {
        if let Ok(data) = libqaul::api::receive_rpc() {
            // This forwards messages, contacts, feeds, etc. to your frontend
            Rpc::received_message(data);
        }
        // Tiny sleep to prevent busy-loop (10ms = ~100 FPS max, barely any CPU)
        async_std::task::sleep(std::time::Duration::from_millis(10)).await;
    }
}

/// 
/// Returns a vector of internet neighbours with their RTT and connection status
/// This function is designed to be consumed by the UI layer for network monitoring
pub fn get_internet_neighbours_ui() -> Vec<InternetNeighbourInfo> {
    let mut neighbours = Vec::new();
    
    // Get internet-only neighbours from the neighbours module
    let internet_nodes = libqaul::router::neighbours::Neighbours::get_internet_only_nodes();
    
    for peer_id in internet_nodes {
        // Get RTT for this internet neighbour
        let rtt = libqaul::router::neighbours::Neighbours::get_rtt(&peer_id, &libqaul::connections::ConnectionModule::Internet);
        
        // Get connection status from internet module
        let (address, name, online) = libqaul::connections::internet::Internet::get_peer_info(&peer_id);
        
        neighbours.push(InternetNeighbourInfo {
            peer_id: peer_id.to_bytes(),
            address: address.unwrap_or_else(|| "Unknown".to_string()),
            name: name.unwrap_or_else(|| "Unknown".to_string()),
            online,
            rtt_ms: rtt.map(|r| r / 1000), // Convert microseconds to milliseconds
        });
    }
    
    neighbours
}