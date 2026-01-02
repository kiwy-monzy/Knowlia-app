use libqaul::router::table::RoutingTable;
use libqaul::node::UserAccounts;
use libqaul::storage::configuration::{Configuration, UserProfile};
use serde::{Deserialize, Serialize};
use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use libqaul::router::users::{USERS, Users};
use libqaul::utilities::qaul_id::QaulId;
use log::{info, warn};

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
#[tauri::command]
pub async fn get_all_users() -> Result<String, String> {
    match Users::get_all_users_info() {
        users_json => {
            // The Users::get_all_users_info() already returns a JSON string
            // with both profile data and connection information
            Ok(users_json)
        }
    }
}

/// Get online users - Enhanced version
#[tauri::command]
pub async fn get_online_users() -> Result<String, String> {
    match RoutingTable::get_online_users() {
        json_string => Ok(json_string),
    }
}

/// Get offline users - Enhanced version
#[tauri::command]
pub async fn get_offline_users() -> Result<String, String> {
    match RoutingTable::get_offline_users() {
        json_string => Ok(json_string),
    }
}

/// Get current user profile
#[tauri::command]
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
#[tauri::command]
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

/// Add a new user
#[tauri::command]
pub async fn add_user(name: String) -> Result<String, String> {
    use libqaul::node::UserAccounts;
    
    // Create a new user account using libqaul's API
    let user_account = UserAccounts::create(
        name.clone(),
        None, // profile_pic
        None, // about
        None, // reg_no
        None, // college
    );
    
    // Return user info as JSON
    let user_info = serde_json::json!({
        "id": user_account.id.to_string(),
        "name": name
    });
    
    Ok(user_info.to_string())
}

/// Get active RTC sessions
#[tauri::command]
pub async fn get_active_sessions() -> Result<Vec<serde_json::Value>, String> {
    // For now, return empty sessions list - this can be enhanced later
    // to integrate with actual RTC session management
    Ok(vec![])
}

/// Cleanup inactive users
#[tauri::command]
pub async fn cleanup_inactive_users(_timeout_seconds: u64) -> Result<Vec<String>, String> {
    // For now, return empty list - this can be enhanced later
    // to actually clean up inactive users based on timeout
    Ok(vec![])
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
            add_user,
            get_active_sessions,
            cleanup_inactive_users,
        ])
        .build()
}