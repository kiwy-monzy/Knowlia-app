use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::broadcast;
use serde::{Serialize, Deserialize};
use directories::ProjectDirs;
use rouille::{Response, Server};

use libqaul::router::users::USERS;

/// Information about an internet neighbour for UI consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InternetNeighbourInfo {
    pub peer_id: Vec<u8>,
    pub address: String,
    pub name: String,
    pub online: bool,
    pub rtt_ms: Option<f64>,
}

/// Comprehensive neighbour information for all connection types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllNeighbourInfo {
    pub peer_id: Vec<u8>,
    pub address: String,
    pub name: String,
    pub online: bool,
    pub rtt_ms: Option<f64>,
    pub connection_type: String,
}

/// User information for websocket consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub is_online: bool,
    pub last_seen: Option<u64>,
    pub connection_type: Option<String>,
    pub profile_pic: Option<String>,
    pub about: Option<String>,
    pub college: Option<String>,
    pub reg_no: Option<String>,
}

#[tokio::main]
async fn main() {
    println!("=== Qaul WebSocket Server + HTTP Server ===");
    println!("Initializing libqaul...");
    
    init_libqaul().await;
    
    println!("libqaul initialized successfully!");
    
    // Debug: Check user store count
    if let Ok(users) = USERS.get().read() {
        println!("Loaded {} users from storage.", users.users.len());
    }

    // Start HTTP server for egui web app
    let http_server = tokio::spawn(async {
        let server = Server::new("127.0.0.1:3000", move |request| {
            match request.url() {
                s if s == "/" => Response::html(include_str!("index.html").to_string()),
                s if s == "/egui" => Response::html(include_str!("index.html").to_string()),
                _ => Response::empty_404(),
            }
        }).map_err(|e| e.to_string());
        
        println!("HTTP server listening on: http://127.0.0.1:3000");
        println!("egui web app available at: http://127.0.0.1:3000/egui");
        server
    });

    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind");
    println!("WebSocket server listening on: ws://{}", addr);

    let (tx, _rx) = broadcast::channel::<String>(100);
    let tx = Arc::new(tx);
    let tx_clone = tx.clone();
    
    // Broadcast loop
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
        loop {
            interval.tick().await;
            let all_neighbours = get_all_neighbours_ui();
            let internet_neighbours = get_internet_neighbours_ui();
            let users = get_users_ui();
            let stats = get_network_stats().unwrap();
            
            let update = json!({
                "type": "update",
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "data": {
                    "all_neighbours": all_neighbours,
                    "internet_neighbours": internet_neighbours,
                    "users": users,
                    "stats": stats
                }
            });
            let _ = tx_clone.send(update.to_string());
        }
    });

    while let Ok((stream, addr)) = listener.accept().await {
        println!("✓ New WebSocket connection from: {}", addr);
        let tx = tx.clone();
        tokio::spawn(handle_connection(stream, tx, addr));
    }
}

use base64::Engine;

fn load_logo_base64() -> Option<String> {
    let path = std::path::Path::new("src/bin/logo.png");
    let bytes = std::fs::read(path).ok()?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Some(format!("data:image/png;base64,{}", encoded))
}

async fn init_libqaul() {
    // Use ProjectDirs to match the main app's storage location: "net.qaul.qaul"
    let storage_path = if let Some(proj_dirs) = ProjectDirs::from("net", "qaul", "qaul") {
        let path = proj_dirs.data_local_dir();
        // Typically main app just uses data_local_dir, but we verify if we need to append
        path.to_string_lossy().to_string()
    } else {
        // Fallback
        std::env::current_dir()
            .expect("Failed to get current directory")
            .join("qaul_data")
            .to_string_lossy()
            .to_string()
    };
    
    // If your main app specifically appends "qaul_data" or another folder inside that path,
    // you should append it here. But usually ProjectDirs gives the app root.
    // Based on "net", "qaul", "qaul", it maps to C:\Users\User\AppData\Local\qaul\qaul on Windows.

    println!("Storage Path: {}", storage_path);
    std::fs::create_dir_all(&storage_path).ok();
    
    let config: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
    libqaul::api::start_with_config(storage_path, Some(config));
    
    while !libqaul::api::initialization_finished() {
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }
    
    libqaul::node::user_accounts::UserAccounts::init_active_users_in_router();
    
    if libqaul::node::user_accounts::UserAccounts::len() == 0 {
        let profile_pic = load_logo_base64();
        let _ = libqaul::node::user_accounts::UserAccounts::create(
            "Monitor".to_string(),
            profile_pic,
            None, None, None,
        );
        println!("Created default user: Monitor");
    }
    
    tokio::spawn(async move {
        loop {
            if let Ok(_) = libqaul::api::receive_rpc() { }
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
    });
}

async fn handle_connection(stream: TcpStream, tx: Arc<broadcast::Sender<String>>, _client_addr: std::net::SocketAddr) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => { eprintln!("Error: {}", e); return; }
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut rx = tx.subscribe();

    // Initial send
    let update = json!({
        "type": "initial",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "data": {
            "all_neighbours": get_all_neighbours_ui(),
            "internet_neighbours": get_internet_neighbours_ui(),
            "users": get_users_ui(),
            "stats": get_network_stats().unwrap()
        }
    });
    let _ = ws_sender.send(Message::Text(update.to_string())).await;

    loop {
        tokio::select! {
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        match text.as_str() {
                            "get_all" => {
                                let data = json!({
                                    "type": "response",
                                    "command": "get_all",
                                    "timestamp": chrono::Utc::now().to_rfc3339(),
                                    "data": get_all_neighbours_ui()
                                });
                                let _ = ws_sender.send(Message::Text(data.to_string())).await;
                            }
                            "get_internet" => {
                                let data = json!({
                                    "type": "response",
                                    "command": "get_internet",
                                    "timestamp": chrono::Utc::now().to_rfc3339(),
                                    "data": get_internet_neighbours_ui()
                                });
                                let _ = ws_sender.send(Message::Text(data.to_string())).await;
                            }
                            "get_stats" => {
                                let data = json!({
                                    "type": "response",
                                    "command": "get_stats",
                                    "timestamp": chrono::Utc::now().to_rfc3339(),
                                    "data": get_network_stats().unwrap()
                                });
                                let _ = ws_sender.send(Message::Text(data.to_string())).await;
                            }
                            "get_users" => {
                                let data = json!({
                                    "type": "response",
                                    "command": "get_users",
                                    "timestamp": chrono::Utc::now().to_rfc3339(),
                                    "data": get_users_ui()
                                });
                                let _ = ws_sender.send(Message::Text(data.to_string())).await;
                            }
                            _ => {}
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            update = rx.recv() => {
                if let Ok(data) = update {
                    if let Err(_) = ws_sender.send(Message::Text(data)).await { break; }
                }
            }
        }
    }
}


pub fn get_all_neighbours_ui() -> Vec<AllNeighbourInfo> {
    let mut all_neighbours = Vec::new();
    // Access the USERS store directly, effectively acting as "the top function" logic
    let users_guard = USERS.get().read().unwrap();
    let all_nodes = libqaul::router::neighbours::Neighbours::get_all_neighbours();
    
    for peer_id in all_nodes {
        let connection_module = libqaul::router::neighbours::Neighbours::is_neighbour(&peer_id);
        
        // FIX: Ensure we look up the user using the correct key format (bytes)
        // This prevents falling back to "LAN Node" if the user actually exists in the store
        let real_name = users_guard.users.get(&peer_id.to_bytes().to_vec())
            .map(|u| u.name.clone())
            .filter(|n| !n.is_empty()); // Also check for empty names

        let connection_type = match connection_module {
            libqaul::connections::ConnectionModule::Internet => "internet",
            libqaul::connections::ConnectionModule::Lan => "lan",
            libqaul::connections::ConnectionModule::Ble => "ble",
            libqaul::connections::ConnectionModule::Local => "local",
            libqaul::connections::ConnectionModule::None => "none",
        };
        
        let rtt = libqaul::router::neighbours::Neighbours::get_rtt(&peer_id, &connection_module);
        let rtt_ms = rtt.map(|r| r as f64 / 1000.0);

        let (address, name, online) = match connection_module {
            libqaul::connections::ConnectionModule::Internet => {
                libqaul::connections::internet::Internet::get_peer_info(&peer_id)
            }
            _ => {
                let prefix = match connection_module {
                    libqaul::connections::ConnectionModule::Lan => "LAN",
                    libqaul::connections::ConnectionModule::Ble => "BLE",
                    libqaul::connections::ConnectionModule::Local => "Local",
                    _ => "Unknown",
                };
                let address = Some(format!("{}:{}", prefix, peer_id.to_base58().chars().take(8).collect::<String>()));
                
                // Use the retrieved real_name if available, otherwise fallback
                let name = if let Some(n) = real_name {
                    Some(n)
                } else {
                    Some(format!("{} Node {}", prefix, peer_id.to_base58().chars().take(4).collect::<String>()))
                };
                
                (address, name, true)
            }
        };
        
        all_neighbours.push(AllNeighbourInfo {
            peer_id: peer_id.into(),
            address: address.unwrap_or_else(|| "Unknown".to_string()),
            name: name.unwrap_or_else(|| "Unknown".to_string()),
            online,
            rtt_ms,
            connection_type: connection_type.to_string(),
        });
    }
    
    all_neighbours
}


pub fn get_internet_neighbours_ui() -> Vec<InternetNeighbourInfo> {
    let mut neighbours = Vec::new();
    let internet_nodes = libqaul::router::neighbours::Neighbours::get_internet_only_nodes();
    
    for peer_id in internet_nodes {
        let rtt = libqaul::router::neighbours::Neighbours::get_rtt(
            &peer_id, 
            &libqaul::connections::ConnectionModule::Internet
        );
        let rtt_ms = rtt.map(|r| r as f64 / 1000.0);
        
        let (address, name, online) = libqaul::connections::internet::Internet::get_peer_info(&peer_id);
        
        neighbours.push(InternetNeighbourInfo {
            peer_id: peer_id.into(),
            address: address.unwrap_or_else(|| "Unknown".to_string()),
            name: name.unwrap_or_else(|| "Unknown".to_string()),
            online,
            rtt_ms,
        });
    }
    
    neighbours
}

pub fn get_network_stats() -> Result<serde_json::Value, String> {
    let all_neighbours = get_all_neighbours_ui();
    let internet_neighbours = get_internet_neighbours_ui();
    
    let stats = json!({
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
        "average_rtt_ms": if internet_neighbours.len() > 0 {
            let total_rtt: f64 = internet_neighbours.iter()
                .filter_map(|n| n.rtt_ms)
                .sum();
            Some(total_rtt / internet_neighbours.len() as f64)
        } else {
            None
        }
    });
    
    Ok(stats)
}

pub fn get_users_ui() -> Vec<UserInfo> {
    let mut users = Vec::new();
    
    // Use the existing get_all_users_info() function which already provides the correct structure
    match libqaul::router::users::Users::get_all_users_info() {
        users_json => {
            if let Ok(all_users) = serde_json::from_str::<Vec<serde_json::Value>>(&users_json) {
                for user_value in all_users {
                    // Extract base object and user data
                    if let Some(base) = user_value.get("base") {
                        if let (Some(id), Some(name), Some(is_online)) = (
                            base.get("id").and_then(|v| v.as_str()),
                            base.get("name").and_then(|v| v.as_str()),
                            user_value.get("is_online").and_then(|v| v.as_bool())
                        ) {
                            // Get additional user data from the base object
                            let profile_pic = base.get("profile").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let about = base.get("about").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let college = base.get("college").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let last_seen = user_value.get("last_seen").and_then(|v| v.as_u64());
                            
                            // Extract reg_no from college field - libqaul stores college and regNo together in college field
                            // Format is typically "College Name - RegNo" or just "College Name" 
                            let reg_no = college.as_ref().and_then(|college_str| {
                                // Try to split by dash to separate reg_no
                                college_str.split('-').nth(1).map(|s| s.trim().to_string())
                            });
                            
                            // Get connection type if online
                            let connection_type = if is_online {
                                if let Some(connections) = user_value.get("connections").and_then(|v| v.as_array()) {
                                    if let Some(first_connection) = connections.first() {
                                        first_connection.get("module")
                                            .and_then(|v| v.as_u64())
                                            .and_then(|m| match m {
                                                1 => Some("internet".to_string()),
                                                2 => Some("lan".to_string()),
                                                3 => Some("ble".to_string()),
                                                4 => Some("local".to_string()),
                                                _ => Some("none".to_string()),
                                            })
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            } else {
                                None
                            };
                            
                            users.push(UserInfo {
                                id: id.to_string(),
                                name: name.to_string(),
                                is_online,
                                last_seen,
                                connection_type,
                                profile_pic,
                                about,
                                college,
                                reg_no,
                            });
                        }
                    }
                }
            }
        }
    }
    
    users
}