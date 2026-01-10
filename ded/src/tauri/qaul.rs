use tauri::{plugin::{Builder, TauriPlugin}, AppHandle, Runtime, Emitter, Manager, Listener};
use std::sync::Arc;
use tauri_plugin_notification::NotificationExt;

use crate::modes::{user_accounts::UserAccounts, rpc::Rpc};
use libqaul::node::user_accounts::UserAccounts as LibqaulUserAccounts;

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
    pub rtt_ms: Option<f64>,
}

/// Comprehensive neighbour information for all connection types
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AllNeighbourInfo {
    /// Peer ID as bytes
    pub peer_id: Vec<u8>,
    /// Address of the peer
    pub address: String,
    /// Name of the peer
    pub name: String,
    /// Online status
    pub online: bool,
    /// Round trip time in milliseconds
    pub rtt_ms: Option<f64>,
    /// Connection type: "lan", "internet", "ble", "local", "none"
    pub connection_type: String,
}

/// Set the global event emitter for libqaul events
pub fn set_tauri_event_emitter(emitter: std::sync::Arc<dyn Fn(String, serde_json::Value) + Send + Sync>) {
    libqaul::connections::events::set_event_emitter(emitter);
}

/// Optional: expose a command so frontend can send CLI-like commands
#[tauri_crate::command]
pub async fn qaul_send_command(command: String) -> Result<String, String> {
    // Process the command using existing CLI infrastructure
    crate::modes::cli::Cli::process_command(command.clone());
    Ok(format!("Command processed: {}", command))
}

/// Get internet neighbours information for UI
#[tauri_crate::command]
pub fn get_internet_neighbours_ui_command() -> Result<Vec<InternetNeighbourInfo>, String> {
    Ok(get_internet_neighbours_ui())
}

/// Get all neighbours information for UI (LAN, Internet, BLE, Local)
#[tauri_crate::command]
pub fn get_all_neighbours_ui_command() -> Result<Vec<AllNeighbourInfo>, String> {
    Ok(get_all_neighbours_ui())
}

/// Get network statistics for UI
#[tauri_crate::command]
pub fn get_network_stats() -> Result<serde_json::Value, String> {
    // Get network statistics from libqaul
    let all_neighbours = get_all_neighbours_ui();
    let internet_neighbours = get_internet_neighbours_ui();
    
    let stats = serde_json::json!({
        "total_neighbours": all_neighbours.len(),
        "internet_neighbours": internet_neighbours.len(),
        "online_neighbours": all_neighbours.iter().filter(|n| n.online).count(),
        "connection_types": {
            "internet": all_neighbours.iter().filter(|n| n.connection_type == "internet").count(),
            "lan": all_neighbours.iter().filter(|n| n.connection_type == "lan").count(),
            "ble": all_neighbours.iter().filter(|n| n.connection_type == "ble").count(),
            "local": all_neighbours.iter().filter(|n| n.connection_type == "local").count(),
            "none": all_neighbours.iter().filter(|n| n.connection_type == "none").count()
        },
        "average_rtt_ms": if !internet_neighbours.is_empty() {
            let rtts: Vec<f64> = internet_neighbours.iter()
                .filter_map(|n| n.rtt_ms)
                .collect();
            
            if !rtts.is_empty() {
                Some(rtts.iter().sum::<f64>() / rtts.len() as f64)
            } else {
                None
            }
        } else {
            None
        }
    });
    
    Ok(stats)
}

/// Public init function – used from main.rs
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("qaul")
        .invoke_handler(tauri::generate_handler![qaul_send_command, get_internet_neighbours_ui_command, get_all_neighbours_ui_command, get_network_stats])
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
    // Initialize active users in router
    LibqaulUserAccounts::init_active_users_in_router();
    
    // Create default user if none exists
    if libqaul::node::user_accounts::UserAccounts::len() == 0 {
       let _ = libqaul::node::user_accounts::UserAccounts::create(
           "USER@2026".to_string(),
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
/// Returns a vector of all neighbours (Internet only for now, with placeholders for other types)
/// This function is designed to be consumed by the UI layer for comprehensive network monitoring
/// Note: Currently only Internet connections are fully supported in libqaul API
pub fn get_all_neighbours_ui() -> Vec<AllNeighbourInfo> {
    let mut all_neighbours = Vec::new();
    
    // Get all neighbours from the neighbours module
    let all_nodes = libqaul::router::neighbours::Neighbours::get_all_neighbours();
    
    // Get profiles
    let users = libqaul::router::users::USERS.get().read().unwrap();
    
    for peer_id in all_nodes {
        // Determine connection type
        let connection_module = libqaul::router::neighbours::Neighbours::is_neighbour(&peer_id);
        let connection_type = match connection_module {
            libqaul::connections::ConnectionModule::Internet => "internet",
            libqaul::connections::ConnectionModule::Lan => "lan",
            libqaul::connections::ConnectionModule::Ble => "ble",
            libqaul::connections::ConnectionModule::Local => "local",
            libqaul::connections::ConnectionModule::None => "none",
        };
        
        // Get RTT for this neighbour (in microseconds converted to ms)
        let rtt = libqaul::router::neighbours::Neighbours::get_rtt(&peer_id, &connection_module);
        let rtt_ms = rtt.map(|r| r as f64 / 1000.0);
        
        // Get peer info based on connection type
        let (address, mut name, online) = match connection_module {
            libqaul::connections::ConnectionModule::Internet => {
                libqaul::connections::internet::Internet::get_peer_info(&peer_id)
            }
            _ => {
                // For non-Internet connections, use placeholder info
                let prefix = match connection_module {
                    libqaul::connections::ConnectionModule::Lan => "LAN",
                    libqaul::connections::ConnectionModule::Ble => "Bluetooth",
                    libqaul::connections::ConnectionModule::Local => "Local",
                    _ => "Unknown",
                };
                let address = Some(format!("{}:{}", prefix, peer_id.to_base58().chars().take(8).collect::<String>()));
                let name = Some(format!("{} Node {}", prefix, peer_id.to_base58().chars().take(4).collect::<String>()));
                let online = true; // Assume online for now
                (address, name, online)
            }
        };

        // If we have a better name from the qaul profile, use it
        let q8id = libqaul::utilities::qaul_id::QaulId::to_q8id(peer_id.clone());
        if let Some(user) = users.users.get(&q8id) {
            if !user.name.is_empty() {
                name = Some(user.name.clone());
            } else {
                // Request info if name is empty
                libqaul::router::users::Users::request_user_info(&peer_id);
            }
        } else {
            // Unknown user, request info
            libqaul::router::users::Users::request_user_info(&peer_id);
        }
        
        all_neighbours.push(AllNeighbourInfo {
            peer_id: peer_id.to_bytes(),
            address: address.unwrap_or_else(|| "Unknown".to_string()),
            name: name.unwrap_or_else(|| "Unknown".to_string()),
            online,
            rtt_ms,
            connection_type: connection_type.to_string(),
        });
    }
    
    all_neighbours
}

/// 
/// Returns a vector of internet neighbours with their RTT and connection status
/// This function is designed to be consumed by the UI layer for network monitoring
pub fn get_internet_neighbours_ui() -> Vec<InternetNeighbourInfo> {
    let mut neighbours = Vec::new();
    let users = libqaul::router::users::USERS.get().read().unwrap();
    
    // Get internet-only neighbours from the neighbours module
    let internet_nodes = libqaul::router::neighbours::Neighbours::get_internet_only_nodes();
    
    for peer_id in internet_nodes {
        // Get RTT for this internet neighbour
        let rtt = libqaul::router::neighbours::Neighbours::get_rtt(&peer_id, &libqaul::connections::ConnectionModule::Internet);
        
        // Get connection status from internet module
        let (address, mut name, online) = libqaul::connections::internet::Internet::get_peer_info(&peer_id);
        
        // Try to get profile name
        let q8id = libqaul::utilities::qaul_id::QaulId::to_q8id(peer_id.clone());
        if let Some(user) = users.users.get(&q8id) {
            if !user.name.is_empty() {
                name = Some(user.name.clone());
            }
        }

        neighbours.push(InternetNeighbourInfo {
            peer_id: peer_id.to_bytes(),
            address: address.unwrap_or_else(|| "Unknown".to_string()),
            name: name.unwrap_or_else(|| "Unknown".to_string()),
            online,
            rtt_ms: rtt.map(|r| r as f64 / 1000.0),
        });
    }
    
    neighbours
}