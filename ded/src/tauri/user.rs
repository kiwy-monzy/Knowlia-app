use libqaul::router::table::RoutingTable;
use libqaul::node::UserAccounts;
use libqaul::storage::configuration::{Configuration, UserProfile};
use serde::{Deserialize, Serialize};
use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use libqaul::router::users::{USERS, Users};
use libqaul::utilities::qaul_id::QaulId;
use log::{info, warn};
use libqaul::router;
use libqaul::connections;
use libp2p::PeerId;
use serde_json::json;
use bs58;
use hex;

/// User information structure (kept for backward compatibility)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    pub is_online: bool,
    pub last_seen: Option<u64>,
    pub connection_type: Option<String>,
}

/// User list structure for frontend compatibility
#[derive(Debug, Serialize, Deserialize)]
pub struct UserList {
    users: Vec<UserInfo>,
    total_count: usize,
    online_count: usize,
    offline_count: usize,
}

/// Get all users (both online and offline) - Enhanced version
#[tauri_crate::command]
pub async fn get_all_users() -> Result<String, String> {
    // Get all users from the users store
    let users = USERS.get().read().unwrap();
    println!("Total users in store: {}", users.users.len());
    
    // Get all neighbour nodes from router
    let all_nodes = router::neighbours::Neighbours::get_all_neighbours();
    println!("Total neighbour nodes found: {}", all_nodes.len());
    
    // Get routing table entries to know all reachable users
    let routing_users = RoutingTable::get_online_users_info();
    println!("Total users in routing table: {}", routing_users.len());
    
    // Log details of each node and its users
    for node in &all_nodes {
        let q8id = QaulId::to_q8id(node.clone());
        println!("Node: {} -> Q8ID: {}", node.to_base58(), bs58::encode(&q8id).into_string());
        
        // Check if this node has a user in the users store
        if let Some(user) = users.users.get(&q8id) {
            println!("  - User found: {} (ID: {})", user.name, user.id.to_base58());
        } else {
            println!("  - No user found for this node in users store");
        }
        
        // Check routing entries for this node
        if let Some(entries) = routing_users.get(&q8id) {
            println!("  - Routing entries: {}", entries.len());
            for entry in entries {
                println!("    - Via: {} (Module: {:?}, RTT: {}ms, Hop: {})", 
                    entry.node.to_base58(), entry.module, entry.rtt, entry.hc);
            }
        }
    }
    
    // Get all users info (existing functionality)
    match Users::get_all_users_info() {
        users_json => {
            println!("Returning users JSON: {}", users_json);
            Ok(users_json)
        }
    }
}

/// Get online users - Enhanced version
#[tauri_crate::command]
pub async fn get_online_users() -> Result<String, String> {
    match RoutingTable::get_online_users() {
        json_string => Ok(json_string),
    }
}

/// Get offline users - Enhanced version
#[tauri_crate::command]
pub async fn get_offline_users() -> Result<String, String> {
    match RoutingTable::get_offline_users() {
        json_string => Ok(json_string),
    }
}

/// Get current user profile
#[tauri_crate::command]
pub async fn user_profile() -> Result<String, String> {
    // Get the current user account
    match UserAccounts::get_default_user() {
        Some(user_account) => {
            // Get user data from the users store
            let users = USERS.get().read().unwrap();
            let q8id = QaulId::to_q8id(user_account.id);
            
            match users.users.get(&q8id) {
                Some(user_data) => {
                    let profile_data = serde_json::json!({
                        "name": user_data.name,
                        "profile": user_data.profile_pic,
                        "about": user_data.about,
                        "reg_no": user_data.reg_no,
                        "college": user_data.college
                    });
                    Ok(profile_data.to_string())
                }
                None => Err("User not found in users store".to_string())
            }
        }
        None => Err("No user account selected".to_string())
    }
}

/// Update current user profile
#[tauri_crate::command]
pub async fn set_node_profile_tauri(name: String, college: String, reg_no: String, profile: String, about: String) -> Result<(), String> {
    info!("set_node_profile_tauri called with name: {}, college: {}, reg_no: {}", name, college, reg_no);
    
    // Create UserProfile struct
    let user_profile = UserProfile {
        name: name.clone(),
        college: college.clone(),
        reg_no: reg_no.clone(),
        profile: profile.clone(),
        about: about.clone(),
    };
    
    // Use the configuration's set_node_profile function
    Configuration::set_node_profile(user_profile);
    
    // Also update the users store to keep both systems in sync
    if let Some(user_account) = UserAccounts::get_default_user() {
        info!("Updating users store for user: {}", user_account.id);
        let users = USERS.get();
        let mut users_write = users.write().unwrap();
        let q8id = QaulId::to_q8id(user_account.id);
        
        if let Some(user_data) = users_write.users.get_mut(&q8id) {
            user_data.name = name;
            user_data.profile_pic = Some(profile);
            user_data.about = Some(about);
            user_data.reg_no = Some(reg_no);
            user_data.college = Some(college);
            info!("Updated users store successfully");
        } else {
            warn!("User not found in users store: {:?}", q8id);
        }
    } else {
        warn!("No default user account found");
    }
    
    Ok(())
}



/// Return a JSON object summarising all neighbours grouped by connection module.
/// This is a helper for the UI layer and is **not** exposed as a Tauri command
/// because it performs no I/O and cannot fail.
/// Return a JSON object summarising all neighbours grouped by connection module.
/// This also maps PeerIds to Usernames from the libqaul profile store.
#[tauri_crate::command]
pub fn get_all_neighbours() -> serde_json::Value {
    let users = USERS.get().read().unwrap();
    let mut lan_neighbours = Vec::new();
    let mut ble_neighbours = Vec::new();
    let mut internet_neighbours = Vec::new();

    // Get all direct neighbours from the neighbours module
    let all_nodes = router::neighbours::Neighbours::get_all_neighbours();
    
    // Helper function to get user profile and a proper display name
    let get_user_profile = |peer_id: &PeerId| -> (serde_json::Value, String) {
        let q8id = QaulId::to_q8id(peer_id.clone());
        let peer_id_hex = hex::encode(peer_id.to_bytes());
        let peer_id_b58 = peer_id.to_base58();
        let shortened_id = if peer_id_b58.len() > 8 {
            format!("Node-{}", &peer_id_b58[..6])
        } else {
            peer_id_b58.clone()
        };

        if let Some(user) = users.users.get(&q8id) {
            let name = if user.name.is_empty() { 
                // Request info in background if name is empty
                info!("Requesting missing user info for {}", peer_id.to_base58());
                libqaul::router::users::Users::request_user_info(peer_id);
                shortened_id.clone() 
            } else { 
                user.name.clone() 
            };
            (json!({
                "name": name,
                "profile": user.profile_pic.as_deref().unwrap_or(""),
                "about": user.about.as_deref().unwrap_or(""),
                "college": user.college.as_deref().unwrap_or(""),
                "reg_no": user.reg_no.as_deref().unwrap_or(""),
                "verified": user.verified,
                "blocked": user.blocked,
                "q8id": bs58::encode(&q8id).into_string(),
                "id": peer_id_hex,
                "key_base58": bs58::encode(peer_id.to_bytes()).into_string(),
                "is_online": true,
            }), name)
        } else {
            // New unknown user, request info
            info!("Unknown user detected, requesting info for {}", peer_id.to_base58());
            libqaul::router::users::Users::request_user_info(peer_id);
            
            (json!({
                "name": shortened_id.clone(),
                "profile": "",
                "about": "",
                "college": "",
                "reg_no": "",
                "verified": false,
                "blocked": false,
                "q8id": bs58::encode(q8id).into_string(),
                "id": peer_id_hex,
                "key_base58": bs58::encode(peer_id.to_bytes()).into_string(),
                "is_online": true,
            }), shortened_id)
        }
    };

    // Helper to format RTT from microseconds to fractional milliseconds
    let format_rtt = |rtt_micros: Option<u32>| -> f64 {
        rtt_micros.map(|r| r as f64 / 1000.0).unwrap_or(0.0)
    };

    for peer_id in all_nodes {
        let connection_module = router::neighbours::Neighbours::is_neighbour(&peer_id);
        let rtt = router::neighbours::Neighbours::get_rtt(&peer_id, &connection_module);
        let rtt_ms = format_rtt(rtt);
        let (user_profile, display_name) = get_user_profile(&peer_id);
        
        let node_data = json!({
            "node_id": peer_id.to_bytes(),
            "peer_id": peer_id.to_base58(),
            "rtt": rtt_ms,
            "name": display_name,
            "user_name": display_name,
            "connection_type": match connection_module {
                connections::ConnectionModule::Lan => "lan",
                connections::ConnectionModule::Ble => "ble",
                connections::ConnectionModule::Internet => "internet",
                _ => "unknown"
            },
            "user": user_profile,
            "online": true
        });

        match connection_module {
            connections::ConnectionModule::Lan => lan_neighbours.push(node_data),
            connections::ConnectionModule::Ble => ble_neighbours.push(node_data),
            connections::ConnectionModule::Internet => {
                let (address, config_name, _) = connections::internet::Internet::get_peer_info(&peer_id);
                let mut final_node_data = node_data;
                // For internet nodes, prefer the configuration name if found
                if let Some(cname) = config_name {
                    final_node_data["name"] = json!(cname);
                }
                if let Some(addr) = address {
                    final_node_data["address"] = json!(addr);
                }
                internet_neighbours.push(final_node_data);
            },
            _ => {}
        }
    }

    json!({
        "lan": lan_neighbours,
        "ble": ble_neighbours,
        "internet": internet_neighbours,
        "total_count": lan_neighbours.len() + ble_neighbours.len() + internet_neighbours.len()
    })
}

/// Register user-related Tauri commands
pub fn register_commands<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("user")
        .invoke_handler(tauri::generate_handler![
            get_all_users,
            get_online_users,
            get_offline_users,
            user_profile,
            set_node_profile_tauri,
            get_all_neighbours,
        ])
        .build()
}