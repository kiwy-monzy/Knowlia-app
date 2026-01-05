// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Tauri Group Management Module
//!
//! This module provides Tauri-compatible CRUD operations for group management
//! using the underlying libqaul group services.
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime
};
use crate::get_current_user_internal;
use libp2p::PeerId;
use libqaul::services::group::{GroupManage, Member, ProtoGroupMember};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use libqaul::services::chat::storage::ChatStorage;
use libqaul::services::chat::rpc_proto;
use libqaul::services::chat::file;
use libqaul::services::chat::file::proto_rpc::FileHistoryRequest;
use libqaul::router::users::Users;
use base64::{engine::general_purpose::STANDARD as base64, Engine};
use hex;
use libqaul::utilities::qaul_id::QaulId;
use libqaul::node::user_accounts::UserAccounts;

/// Helper function to find user data by iterating through all users (like get_all_users_info)
fn find_user_by_peer_id(peer_id: &PeerId) -> Option<libqaul::router::users::User> {
    use libqaul::router::users::USERS;
    
    let users = USERS.get().read().unwrap();
    let target_q8id = QaulId::to_q8id(peer_id.clone());
    
    // Iterate through all users to find the matching one
    for (q8id, user) in users.users.iter() {
        if q8id == &target_q8id {
            return Some(user.clone());
        }
    }
    
    None
}



/// Result type for group operations
pub type GroupResult<T> = Result<T, String>;

/// Create a new group
///
/// # Arguments
/// * `name` - The name of the group to create
///
/// # Returns
/// * `Ok(group_id)` - The ID of the newly created group
/// * `Err(error)` - Error message if creation fails
#[tauri::command]
pub async fn create_group(name: String) -> GroupResult<Vec<u8>> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id = GroupManage::create_new_group(&account_id, name);
    Ok(group_id)
}

/// Create or get an existing direct chat group with another user
///
/// # Arguments
/// * `contact_id` - The base58 encoded PeerId of the contact
///
/// # Returns
/// * `Ok(group_id_hex)` - The hex encoded group ID
/// * `Err(error)` - Error message if creation fails
#[tauri::command]
pub fn get_or_create_direct_chat(contact_id: String) -> Result<String, String> {
    use libp2p::PeerId;
    use libqaul::services::group::GroupManage;

    // Get current user
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let user_peer_id = current_user.id;
    
    // Decode contact_id from base58 to bytes
    let contact_bytes = bs58::decode(&contact_id)
        .into_vec()
        .map_err(|e| format!("Invalid contact ID (base58 decode failed): {}", e))?;
    
    // Convert contact bytes to PeerId
    let contact_peer_id = PeerId::from_bytes(&contact_bytes)
        .map_err(|e| format!("Invalid contact PeerId: {}", e))?;
    
    let group = GroupManage::create_new_direct_chat_group(&user_peer_id, &contact_peer_id);
    
    // Convert group ID to hex string for frontend
    let group_id_hex = hex::encode(&group.id);
    Ok(group_id_hex)
}

/// Create a new direct chat group with another user
///
/// # Arguments
/// * `remote_user_id` - The PeerId of the remote user
///
/// # Returns
/// * `Ok(group)` - The created or retrieved direct chat group
/// * `Err(error)` - Error message if creation fails
#[allow(dead_code)]
#[tauri::command]
pub async fn create_direct_chat(remote_user_id: String) -> GroupResult<GroupInfo> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let remote_id = remote_user_id
        .parse::<PeerId>()
        .map_err(|e| format!("Invalid remote user ID: {}", e))?;

    let group = GroupManage::get_group_create_direct(
        account_id,
        libqaul::services::group::GroupId::from_peers(&account_id, &remote_id),
        &remote_id,
    )
    .ok_or("Failed to create direct chat group")?;

    Ok(group.into())
}

#[allow(dead_code)]
/// Get information about a specific group
///
/// # Arguments
/// * `group_id` - The ID of the group to get information for
///
/// # Returns
/// * `Ok(group_info)` - Detailed information about the group
/// * `Err(error)` - Error message if retrieval fails
#[tauri::command]
pub async fn get_group_info(group_id: String) -> GroupResult<GroupInfo> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;
    
    let group_info = GroupManage::group_info(&account_id, &group_id_bytes)?;
    Ok(group_info.into())
}

/// Get a list of all groups for the current user
///
/// # Returns
/// * `Ok(groups)` - List of all groups
/// * `Err(error)` - Error message if retrieval fails
#[tauri::command]
pub async fn get_group_list() -> GroupResult<Vec<GroupInfo>> {
    match get_current_user_internal() {
        Some(current_user) => {
            let account_id = current_user.id;

            let group_list = GroupManage::group_list(&account_id);
            let groups: Vec<GroupInfo> = group_list.groups.into_iter().map(|g| {
                let mut group_info: GroupInfo = g.into();
                
                // Handle direct chat display names
                if group_info.is_direct_chat {
                    // Find the other member (not current user) or handle single member case
                    if let Some(other_member) = group_info.members.iter().find(|m| m.user_id != hex::encode(&account_id.to_bytes())) {
                        // Try to get user name using the same logic as get_all_users_info
                        let user_name = {
                            let peer_id: Option<PeerId> = hex::decode(&other_member.user_id)
                                .ok()
                                .and_then(|bytes| PeerId::from_bytes(&bytes).ok());
                            
                            if let Some(id) = peer_id {
                                if let Some(user) = find_user_by_peer_id(&id) {
                                    user.name
                                } else {
                                    // Fallback to member name if available
                                    if !other_member.base.name.is_empty() {
                                        other_member.base.name.clone()
                                    } else {
                                        // Final fallback to user ID truncated (user_id is already hex string)
                                        format!("{}...", &other_member.user_id[..other_member.user_id.len().min(12)])
                                    }
                                }
                            } else {
                                // Fallback to member name if available
                                if !other_member.base.name.is_empty() {
                                    other_member.base.name.clone()
                                } else {
                                    // Final fallback to user ID truncated (user_id is already hex string)
                                    format!("{}...", &other_member.user_id[..other_member.user_id.len().min(12)])
                                }
                            }
                        };
                        
                        group_info.group_name = user_name;
                    } else {
                        // Handle case where current user is the only member in the direct chat
                        // This can happen in some edge cases, use a default name
                        group_info.group_name = "Direct Chat".to_string();
                    }
                } else {
                    // Handle regular groups
                    if group_info.group_name.is_empty() {
                        group_info.group_name = "Unnamed Group".to_string();
                    }
                }
                
                // Get file count and files for this group
                let group_files = if let Ok(group_id_bytes) = hex::decode(&group_info.group_id) {
                    get_group_files(&group_id_bytes)
                } else {
                    vec![] // Invalid hex, return empty file list
                };
                group_info.file_count = group_files.len() as u32;
                group_info.files = group_files;
                
                // Determine last message status
                group_info.last_message_status = if !group_info.last_message_sender_id.is_empty() {
                    // Check if the last message was sent by the current user
                    if group_info.last_message_sender_id == hex::encode(&account_id.to_bytes()) {
                        // For now, default to 'sent' status - this could be enhanced with actual delivery tracking
                        Some("sent".to_string())
                    } else {
                        // Message was sent by someone else, no status needed
                        None
                    }
                } else {
                    None
                };
                
                group_info
            }).collect();
            Ok(groups)
        }
        None => {
            // No current user, return empty list
            Ok(vec![])
        }
    }
}

#[allow(dead_code)]
/// Rename an existing group
///
/// # Arguments
/// * `group_id` - The ID of the group to rename
/// * `new_name` - The new name for the group
///
/// # Returns
/// * `Ok(())` - Group renamed successfully
/// * `Err(error)` - Error message if rename fails
#[tauri::command]
pub async fn rename_group(group_id: String, new_name: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    GroupManage::rename_group(&account_id, &group_id_bytes, new_name)?;
    Ok(())
}

#[allow(dead_code)]
/// Get a list of pending group invitations
///
/// # Returns
/// * `Ok(invitations)` - List of pending invitations
/// * `Err(error)` - Error message if retrieval fails
#[tauri::command]
pub async fn get_pending_invitations() -> GroupResult<Vec<GroupInvitation>> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let invited_list = GroupManage::invited_list(&account_id);
    let invitations: Vec<GroupInvitation> =
        invited_list.invited.into_iter().map(|i| i.into()).collect();

    Ok(invitations)
}

#[allow(dead_code)]
/// Get a new message ID for a group
///
/// # Arguments
/// * `group_id` - The ID of the group
///
/// # Returns
/// * `Ok(message_id)` - New message ID
/// * `Err(error)` - Error message if generation fails
#[tauri::command]
pub async fn get_new_message_id(group_id: String) -> GroupResult<Vec<u8>> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    let message_id = GroupManage::get_new_message_id(&account_id, &group_id_bytes);

    if message_id.is_empty() {
        return Err("Failed to generate message ID".to_string());
    }

    Ok(message_id)
}

// Format group event messages like the frontend
fn format_group_event(group_event: &libqaul::services::chat::rpc_proto::GroupEvent) -> String {
    match group_event.event_type {
        2 => "joined the group".to_string(),      // GroupEventType::Joined
        7 => "was added to the group".to_string(), // GroupEventType::InviteAccepted
        3 => "left the group".to_string(),         // GroupEventType::Left
        4 => "was removed from the group".to_string(), // GroupEventType::Removed
        5 => "closed the group".to_string(),       // GroupEventType::Closed
        6 => "created the group".to_string(),      // GroupEventType::Created
        1 => "was invited to the group".to_string(),    // GroupEventType::Invited
        _ => format!("unknown event ({})", group_event.event_type),
    }
}

// Decode protobuf ChatContentMessage to extract text content
fn decode_last_message(data: &[u8]) -> String {
    use prost::Message;
    use libqaul::services::chat::rpc_proto::ChatContentMessage;
    
    match ChatContentMessage::decode(data) {
        Ok(chat_msg) => {
            match chat_msg.message {
                Some(libqaul::services::chat::rpc_proto::chat_content_message::Message::ChatContent(content)) => {
                    // Extract the actual text content from ChatContent (already a String)
                    content.text.clone()
                }
                Some(libqaul::services::chat::rpc_proto::chat_content_message::Message::FileContent(_)) => {
                    "<file message>".to_string()
                }
                Some(libqaul::services::chat::rpc_proto::chat_content_message::Message::GroupEvent(group_event)) => {
                    // Parse group event and format it like the frontend
                    format_group_event(&group_event)
                }
                None => "<empty message>".to_string(),
            }
        }
        Err(_) => {
            // Fallback for non-protobuf data or decoding errors
            String::from_utf8(data.to_vec())
                .unwrap_or_else(|_| format!("<binary data: {} bytes>", data.len()))
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInfo {
    pub group_id: String,
    pub group_name: String,
    pub created_at: u64,
    pub status: i32,
    pub revision: u32,
    pub is_direct_chat: bool,
    pub members: Vec<GroupMember>,
    pub unread_messages: u32,
    pub last_message_at: u64,
    pub last_message: String,
    pub last_message_sender_id: String,
    pub last_message_status: Option<String>,
    pub file_count: u32,
    pub files: Vec<FileHistory>,
}

/// Tauri-friendly group member structure with rich user data matching get_all_users
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMember {
    pub user_id: String,
    pub role: i32,
    pub joined_at: u64,
    pub state: i32,
    pub last_message_index: u32,
    pub base: GroupMemberBase,
    pub is_online: bool,
    pub connections: Vec<GroupMemberConnection>,
    pub last_seen: Option<u64>,
}

impl Default for GroupMember {
    fn default() -> Self {
        Self {
            user_id: String::default(),
            role: 0,
            joined_at: 0,
            state: 0,
            last_message_index: 0,
            base: GroupMemberBase::default(),
            is_online: false,
            connections: Vec::new(),
            last_seen: None,
        }
    }
}

impl Default for GroupMemberBase {
    fn default() -> Self {
        Self {
            q8id: String::default(),
            id: String::default(),
            name: String::default(),
            key_base58: String::default(),
            verified: false,
            blocked: false,
            profile: String::default(),
            about: String::default(),
            college: String::default(),
        }
    }
}

/// Base user information matching get_all_users structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMemberBase {
    pub q8id: String,
    pub id: String,
    pub name: String,
    pub key_base58: String,
    pub verified: bool,
    pub blocked: bool,
    pub profile: String,
    pub about: String,
    pub college: String,
}

/// Connection information matching get_all_users structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMemberConnection {
    pub module: u32,
    pub hop_count: u32,
    pub rtt: u32,
    pub via: String,
}

/// Tauri-friendly file history structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHistory {
    pub file_id: Vec<u8>,
    pub file_name: String,
    pub file_extension: String,
    pub file_size: u64,
    pub file_description: String,
    pub sent_at: u64,
    pub sender_id: Vec<u8>,
    pub sender_name: String,
    pub file_path: String,
    pub file_exists: bool,
}

/// Tauri-friendly group invitation structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInvitation {
    pub sender_id: Vec<u8>,
    pub received_at: u64,
    pub group: GroupInfo,
}

// Conversion traits from protobuf to Tauri structures
impl From<libqaul::services::group::proto_rpc::GroupInfo> for GroupInfo {
    fn from(proto: libqaul::services::group::proto_rpc::GroupInfo) -> Self {
        Self {
            group_id: hex::encode(&proto.group_id),
            group_name: proto.group_name,
            created_at: proto.created_at,
            status: proto.status,
            revision: proto.revision,
            is_direct_chat: proto.is_direct_chat,
            members: proto.members.into_iter().map(|m| m.into()).collect(),
            unread_messages: proto.unread_messages,
            last_message_at: proto.last_message_at,
            last_message: decode_last_message(&proto.last_message),
            last_message_sender_id: hex::encode(&proto.last_message_sender_id),
            last_message_status: None, // Will be populated later
            file_count: 0, // Will be populated later
            files: vec![], // Will be populated later
        }
    }
}

impl From<ProtoGroupMember> for GroupMember {
    fn from(proto: ProtoGroupMember) -> Self {
        // Get the user's online status from the user accounts
        let users = libqaul::router::users::USERS.get().read().unwrap();
        let peer_id = match PeerId::from_bytes(&proto.user_id) {
            Ok(pid) => pid,
            Err(_) => return Self::default(), // Return default if peer ID is invalid
        };
        
        // Check if user is online by checking the routing table for active connections
        let target_q8id = QaulId::to_q8id(peer_id.clone());
        let is_online = {
            // Check if user exists in the users map first
            let user_exists = users.users.contains_key(&target_q8id);
            
            // Then check if they appear in the online users list
            let online_users_json = libqaul::router::table::RoutingTable::get_online_users();
            let is_online_user = {
                // Parse the online users JSON to check for this user
                if let Ok(online_data) = serde_json::from_str::<Value>(&online_users_json) {
                    if let Some(users_array) = online_data.as_array() {
                        users_array.iter().any(|user_info| {
                            // Check both string ID and q8id fields, converting to string for comparison
                            if let Some(user_id) = user_info["id"].as_str() {
                                user_id == hex::encode(&target_q8id)
                            } else if let Some(user_id) = user_info["q8id"].as_str() {
                                user_id == hex::encode(&target_q8id)
                            } else if let Some(user_id_bytes) = user_info["id"].as_array() {
                                // Handle case where ID might be a byte array
                                let user_id_str = user_id_bytes.iter()
                                    .map(|b| b.as_u64().unwrap_or(0) as u8)
                                    .collect::<Vec<u8>>();
                                user_id_str == target_q8id
                            } else {
                                false
                            }
                        })
                    } else {
                        false
                    }
                } else {
                    false
                }
            };
            
            user_exists && is_online_user
        };
        
        // Get user's last seen time - not available in User struct, set to None for now
        let last_seen = None;
        
        Self {
            user_id: hex::encode(&proto.user_id),
            role: proto.role,
            joined_at: proto.joined_at,
            state: proto.state,
            last_message_index: proto.last_message_index,
            base: GroupMemberBase {
                q8id: hex::encode(&proto.user_id),
                id: hex::encode(&proto.user_id),
                name: proto.name,
                key_base58: peer_id.to_base58(),
                verified: false, // You may want to implement verification logic
                blocked: false,  // You may want to implement block list check
                profile: format_profile_pic(&proto.profile_pic),
                about: proto.about,
                college: String::new(), // Populate this if you have college info
            },
            is_online,
            connections: Vec::new(), // Populate this if you have connection info
            last_seen,
        }
    }
}

// Helper function to format profile picture URL
fn format_profile_pic(profile_pic: &str) -> String {
    if profile_pic.is_empty() {
        // Return default avatar if no profile pic
        "default-avatar.png".to_string()
    } else if profile_pic.starts_with("http") {
        // If it's already a full URL, return as is
        profile_pic.to_string()
    } else {
        // Otherwise, assume it's a relative path and prepend your media URL
        format!("{}/{}", std::env::var("MEDIA_BASE_URL").unwrap_or_else(|_| "/media".to_string()), profile_pic)
    }
}

impl From<libqaul::services::group::proto_rpc::GroupInvited> for GroupInvitation {
    fn from(proto: libqaul::services::group::proto_rpc::GroupInvited) -> Self {
        Self {
            sender_id: proto.sender_id,
            received_at: proto.received_at,
            group: proto.group.map(|g| g.into()).unwrap_or_else(|| GroupInfo {
                group_id: String::new(),
                group_name: "Unknown Group".to_string(),
                created_at: 0,
                status: 0,
                revision: 0,
                is_direct_chat: false,
                members: vec![],
                unread_messages: 0,
                last_message_at: 0,
                last_message: String::new(),
                last_message_sender_id: String::new(),
                last_message_status: None,
                file_count: 0,
                files: vec![],
            }),
        }
    }
}

impl From<libqaul::services::group::Group> for GroupInfo {
    fn from(group: libqaul::services::group::Group) -> Self {
        // Get all users info once, using same implementation as get_all_users()
        let all_users_json = Users::get_all_users_info();
        let all_users: Vec<serde_json::Value> = serde_json::from_str(&all_users_json)
            .unwrap_or_else(|_| vec![]);
        
        // Create a lookup map for user data by q8id
        let mut user_lookup: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();
        for user in all_users {
            if let Some(q8id) = user.get("base").and_then(|b| b.get("q8id")).and_then(|q| q.as_str()) {
                user_lookup.insert(q8id.to_string(), user);
            }
        }

        Self {
            group_id: hex::encode(&group.id),
            group_name: group.name,
            created_at: group.created_at,
            status: group.status,
            revision: group.revision,
            is_direct_chat: group.is_direct_chat,
            members: group
                .members
                .values()
                .map(|m| {
                    // Get user data to populate name and online status
                    let peer_id: Option<PeerId> = PeerId::from_bytes(&m.user_id).ok();
                    let user_q8id = if let Some(id) = peer_id {
                        QaulId::to_q8id(id)
                    } else {
                        vec![] // Fallback empty q8id if conversion fails
                    };
                    
                    // Use the same user data as get_all_users()
                    let user_data = user_lookup.get(&bs58::encode(&user_q8id).into_string());
                    
                    GroupMember {
                        user_id: hex::encode(&m.user_id),
                        role: m.role,
                        joined_at: m.joined_at,
                        state: m.state,
                        last_message_index: m.last_message_index,
                        base: if let Some(user) = user_data {
                            // Extract data from the same structure as get_all_users()
                            let base = user.get("base").unwrap_or(&serde_json::Value::Null);
                            GroupMemberBase {
                                q8id: base.get("q8id").and_then(|v| v.as_str()).unwrap_or(&bs58::encode(&user_q8id).into_string()).to_string(),
                                id: base.get("id").and_then(|v| v.as_str()).unwrap_or(&hex::encode(&m.user_id)).to_string(),
                                name: {
                                    let base_name = base.get("name").and_then(|v| v.as_str());
                                    if let Some(name) = base_name {
                                        name.to_string()
                                    } else if !m.name.is_empty() {
                                        m.name.clone()
                                    } else {
                                        let encoded = hex::encode(&m.user_id);
                                        let truncated = &encoded[..encoded.len().min(12)];
                                        format!("{}...", truncated)
                                    }
                                },
                                key_base58: base.get("key_base58").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                verified: base.get("verified").and_then(|v| v.as_bool()).unwrap_or(false),
                                blocked: base.get("blocked").and_then(|v| v.as_bool()).unwrap_or(false),
                                profile: base.get("profile").and_then(|v| v.as_str()).unwrap_or("default-avatar.png").to_string(),
                                about: base.get("about").and_then(|v| v.as_str()).unwrap_or("No bio available").to_string(),
                                college: base.get("college").and_then(|v| v.as_str()).unwrap_or("Not specified").to_string(),
                            }
                        } else {
                            // Fallback for users not in the all_users data - use group member data
                            GroupMemberBase {
                                q8id: bs58::encode(&user_q8id).into_string(),
                                id: hex::encode(&m.user_id),
                                name: if !m.name.is_empty() { 
                                    m.name.clone() 
                                } else { 
                                    format!("{}...", &hex::encode(&m.user_id)[..hex::encode(&m.user_id).len().min(12)]) 
                                },
                                key_base58: String::new(),
                                verified: false,
                                blocked: false,
                                profile: if !m.profile_pic.is_empty() { m.profile_pic.clone() } else { "default-avatar.png".to_string() },
                                about: if !m.about.is_empty() { m.about.clone() } else { "No bio available".to_string() },
                                college: if !m.college.is_empty() { m.college.clone() } else { "Not specified".to_string() },
                            }
                        },
                        is_online: user_data
                            .and_then(|u| u.get("is_online"))
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false),
                        connections: user_data
                            .and_then(|u| u.get("connections"))
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter().filter_map(|conn| {
                                    Some(GroupMemberConnection {
                                        module: conn.get("module").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        hop_count: conn.get("hop_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        rtt: conn.get("rtt").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                                        via: conn.get("via").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    })
                                }).collect::<Vec<_>>()
                            })
                            .unwrap_or_default(),
                        last_seen: user_data
                            .and_then(|u| u.get("last_seen"))
                            .and_then(|v| v.as_u64()),
                    }
                })
                .collect(),
            unread_messages: group.unread_messages,
            last_message_at: group.last_message_at,
            last_message: decode_last_message(&group.last_message_data),
            last_message_sender_id: hex::encode(&group.last_message_sender_id),
            last_message_status: None, // Will be populated later
            file_count: 0, // Will be populated later
            files: vec![], // Will be populated later
        }
    }
}

/// Invite a user to a group
///
/// # Arguments
/// * `group_id` - The ID of the group to invite the user to
/// * `user_id` - The PeerId of the user to invite
///
/// # Returns
/// * `Ok(())` - User invited successfully
/// * `Err(error)` - Error message if invitation fails
#[tauri::command]
pub async fn invite_user_to_group(group_id: String, user_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    let invited_user_id = user_id
        .parse::<PeerId>()
        .map_err(|e| format!("Invalid invited user ID: {}", e))?;

    Member::invite(&account_id, &group_id_bytes, &invited_user_id)?;
    Ok(())
}

/// Reply to a group invitation
///
/// # Arguments
/// * `group_id` - The ID of the group
/// * `accept` - Whether to accept (true) or reject (false) the invitation
///
/// # Returns
/// * `Ok(())` - Reply sent successfully
/// * `Err(error)` - Error message if reply fails
#[tauri::command]
pub async fn reply_to_group_invitation(group_id: String, accept: bool) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    Member::reply_invite(&account_id, &group_id_bytes, accept)?;
    Ok(())
}

/// Remove a user from a group
///
/// # Arguments
/// * `group_id` - The ID of the group
/// * `user_id` - The PeerId of the user to remove
///
/// # Returns
/// * `Ok(())` - User removed successfully
/// * `Err(error)` - Error message if removal fails
#[tauri::command]
pub async fn remove_user_from_group(group_id: String, user_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    let target_user_id = user_id
        .parse::<PeerId>()
        .map_err(|e| format!("Invalid user ID: {}", e))?;

    Member::remove(&account_id, &group_id_bytes, &target_user_id)?;
    Ok(())
}

/// Leave a group (remove current user from group)
///
/// # Arguments
/// * `group_id` - The ID of the group to leave
///
/// # Returns
/// * `Ok(())` - Successfully left the group
/// * `Err(error)` - Error message if leaving fails
#[tauri::command]
pub async fn leave_group(group_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID hex: {}", e))?;

    Member::remove(&account_id, &group_id_bytes, &account_id)?;
    Ok(())
}

/// Get file history for a specific group
fn get_group_files(group_id: &[u8]) -> Vec<FileHistory> {
    // Get current user account
    let user_account = match get_current_user_internal() {
        Some(user) => {
            match UserAccounts::get_by_id(user.id) {
                Some(account) => account,
                None => return vec![],
            }
        },
        None => return vec![],
    };

    // Get storage path for building file paths
    let storage_path = libqaul::storage::Storage::get_path();
    let user_files_path = std::path::Path::new(&storage_path)
        .join(user_account.id.to_base58())
        .join("files");

    // Get all file history and filter by group
    let history_req = FileHistoryRequest {
        offset: 0,
        limit: 1000, // Get a large number to get all files
    };

    let all_files = file::ChatFile::file_history(&user_account, &history_req);
    
    // Filter files for this specific group
    let group_files: Vec<FileHistory> = all_files
        .into_iter()
        .filter(|file| file.group_id == group_id)
        .map(|file| {
            // Get sender name from Users database using the same logic as get_all_users_info
            let sender_name = {
                let peer_id = match PeerId::from_bytes(&file.sender_id) {
                    Ok(id) => Some(id),
                    Err(_) => None,
                };
                
                if let Some(id) = peer_id {
                    if let Some(user) = find_user_by_peer_id(&id) {
                        user.name
                    } else {
                        // Fallback to truncated sender ID
                        let sender_id_str = bs58::encode(&file.sender_id).into_string();
                        format!("{}...", &sender_id_str[..sender_id_str.len().min(12)])
                    }
                } else {
                    "Unknown".to_string()
                }
            };

            // Build the full file path with extension
            let file_name = format!("{}.{}", file.file_id, file.file_extension);
            let file_path = user_files_path.join(file_name);
            let file_path_str = file_path.to_string_lossy().to_string();
            
            // Check if file exists
            let file_exists = file_path.exists();

            FileHistory {
                file_id: file.file_id.to_be_bytes().to_vec(),
                file_name: file.file_name.clone(),
                file_extension: file.file_extension.clone(),
                file_size: file.file_size as u64,
                file_description: file.file_description.clone(),
                sent_at: file.sent_at,
                sender_id: file.sender_id.clone(),
                sender_name,
                file_path: file_path_str,
                file_exists,
            }
        })
        .collect();

    group_files
}

/// Open a file using the system default application
///
/// # Arguments
/// * `file_path` - The full path to the file to open
///
/// # Returns
/// * `Ok(())` - File opened successfully
/// * `Err(error)` - Error message if opening fails
#[tauri::command]
pub async fn open_file(file_path: String) -> Result<(), String> {
    use std::process::Command;
    
    
    // Check if file exists before trying to open it
    if !std::path::Path::new(&file_path).exists() {
        return Err(format!("File not found: {}", file_path));
    }
    
    // Use platform-specific commands to open the file
    #[cfg(target_os = "windows")]
    {
        let result = Command::new("cmd")
            .args(&["/C", "start", "", &file_path])
            .spawn();
        
        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file: {}", e)),
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let result = Command::new("open")
            .arg(&file_path)
            .spawn();
        
        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file: {}", e)),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let result = Command::new("xdg-open")
            .arg(&file_path)
            .spawn();
        
        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to open file: {}", e)),
        }
    }
}

/// Get chat messages for a specific group
///
/// # Arguments
/// * `group_id` - The ID of the group to get messages for (as hex string)
///
/// # Returns
/// * `Ok(json)` - JSON string containing messages and files
/// * `Err(error)` - Error message if retrieval fails
#[tauri::command]
pub async fn get_messages(group_id: String) -> Result<String, String> {
    // Get current peer ID
    let peer_id = match get_current_user_internal() {
        Some(user) => user.id,
        None => return Err("No current user found".to_string()),
    };
    
    // Log libqaul storage path for debugging
    let _storage_path = libqaul::storage::Storage::get_path();
    
    // Get current user's peer ID for comparison
    let current_peer_id_bytes = peer_id.to_bytes();
    
    // Parse hex string and convert to bytes
    let group_id_bytes = match hex::decode(&group_id) {
        Ok(bytes) => {
            log::info!("Successfully decoded group ID: {} bytes", bytes.len());
            bytes
        },
        Err(e) => {
            log::error!("Failed to decode group ID '{}': {}", group_id, e);
            return Err(format!("Invalid group ID format: {}. Expected hex string like 'a1b2c3d4...'", e));
        },
    };
    
    // Get the chat messages using ChatStorage
    let conversation_list = ChatStorage::get_messages(peer_id, group_id_bytes.clone());
    
    // Get files for this group
    let group_files = get_group_files(&group_id_bytes);
    
    // Manually serialize to JSON since ChatConversationList doesn't implement Serialize
    let json_messages: Vec<serde_json::Value> = conversation_list
        .message_list
        .iter()
        .map(|msg| {
            // Decode the content from protobuf bytes to string and determine message type
            let (content_text, message_type) = decode_chat_content_with_type(&msg.content);

            // Convert sender_id to hex for lookup
            let sender_id_hex = hex::encode(&msg.sender_id);
            
            // Check if sender is the current user
            let is_current_user = msg.sender_id == current_peer_id_bytes;
            
            // Try to resolve sender name from Users database
            let sender_name = {
                // Convert sender_id to q8id first (8 bytes) before lookup
                let sender_q8id = QaulId::to_q8id(PeerId::from_bytes(&msg.sender_id).unwrap());
                let user = Users::get_user_by_q8id(sender_q8id.clone());
     
                match user {
                    Some(u) => {
                        u.name.clone()
                    },
                    None => {
                        // Fallback to hex ID if user not found
                        sender_id_hex.chars().take(8).collect()
                    }
                }
            };
            
            // Set display name to "You" if it's the current user and it's not a system message
            // For system messages, show the actual user name
            let display_name = if is_current_user && message_type != "system" {
                "You".to_string()
            } else {
                sender_name
            };
            
            // Get sender profile information from router users
            let sender_profile = {
                let peer_id = match PeerId::from_bytes(&msg.sender_id) {
                    Ok(id) => Some(id),
                    Err(_) => {
                        log::warn!("Failed to parse peer ID from message sender");
                        None
                    }
                };
                
                peer_id.and_then(|id| {
                    let user = Users::get_user_by_q8id(id.to_bytes());
                    user.map(|u| {
                        serde_json::json!({
                            "name": u.name,
                            "verified": u.verified,
                            "blocked": u.blocked,
                            "id": id.to_base58()
                        })
                    })
                })
            };
            
            // Check if this message contains a file and add file info
            let file_info = if message_type == "file" {
                // Simplified file handling - no files available yet
                None
            } else {
                None
            };
            
            let mut message_json = serde_json::json!({
                "message_id": hex::encode(&msg.message_id),
                "sender_id": sender_id_hex,
                "sender_name": display_name,
                "is_current_user": is_current_user,
                "sender_profile": sender_profile,
                "content": content_text,
                "message_type": message_type,
                "sent_at": msg.sent_at,
                "received_at": msg.received_at,
                "status": msg.status,
                "index": msg.index,
            });
            
            // Add file info if present
            if let Some(file_info) = file_info {
                message_json["file_info"] = file_info;
            }
            
            message_json
        })
        .collect();
    
    let response = serde_json::json!({
        "group_id": hex::encode(&conversation_list.group_id),
        "message_list": json_messages,
        "files": group_files,
    });
    
    match serde_json::to_string(&response) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize messages: {}", e)),
    }
}

/// Send a message (text or file) to a group
///
/// # Arguments
/// * `group_id` - The ID of the group to send the message to
/// * `message` - The text message content (optional if sending file)
/// * `file_data` - Optional file data (name, description, extension, size, content)
///
/// # Returns
/// * `Ok(())` - Message sent successfully
/// * `Err(error)` - Error message if sending fails
#[tauri::command]
pub async fn send_message(
    group_id: String,
    message: Option<String>,
    file_data: Option<serde_json::Value>,
) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    // Convert hex string to bytes
    let group_id_bytes = hex::decode(&group_id)
        .map_err(|e| format!("Invalid group ID format: {}", e))?;

    // Check if this is a direct chat or group message
    let _is_direct = check_if_direct_chat(&account_id, &group_id_bytes)?;

    if let Some(file_info) = file_data {
        // Send file message
        send_file_message(&account_id, &group_id_bytes, file_info).await?;
    } else if let Some(text_message) = message {
        // Send text message
        send_text_message(&account_id, &group_id_bytes, text_message).await?;
    } else {
        return Err("No message or file provided".to_string());
    }

    Ok(())
}



/// Check if a group is a direct chat
fn check_if_direct_chat(account_id: &PeerId, group_id: &[u8]) -> Result<bool, String> {
    use libqaul::services::group::GroupId;
    
    let groupid = GroupId::from_bytes(&group_id.to_vec())
        .map_err(|e| format!("Invalid group ID: {}", e))?;
    
    Ok(groupid.is_direct(account_id.clone()).is_some())
}

/// Send a text message
async fn send_text_message(
    account_id: &PeerId,
    group_id: &[u8],
    message: String,
) -> Result<(), String> {
    use libqaul::services::chat::message::ChatMessage;
    
    ChatMessage::send_chat_message(account_id, &group_id.to_vec(), message)
        .map_err(|e| format!("Failed to send text message: {}", e))?;
    
    Ok(())
}

/// Send a file to a group or direct chat
/// 
/// This function sends a file using libqaul's chat file transfer system
async fn send_file_message(
    account_id: &PeerId,
    group_id: &[u8],
    file_info: serde_json::Value,
) -> Result<(), String> {
    use libqaul::services::chat::file::ChatFile;
    use std::io::Write;
    
    // Extract file information from the JSON
    let file_name = file_info.get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing file name")?;
    
    let file_description = file_info.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    let file_extension = file_info.get("extension")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    // Check if file name already contains the extension and avoid duplication
    let final_file_name = if file_name.to_lowercase().ends_with(&format!(".{}", file_extension.to_lowercase())) {
        // File name already has the extension, use as-is
        file_name.to_string()
    } else {
        // File name doesn't have the extension, add it
        format!("{}.{}", file_name, file_extension)
    };
    
    let base64_content = file_info.get("content")
        .and_then(|v| v.as_str())
        .ok_or("Missing file content")?;
    
    // Get the user account
    let user_account = match libqaul::node::user_accounts::UserAccounts::get_by_id(*account_id) {
        Some(account) => account,
        None => return Err("User account not found".to_string()),
    };
    
    // Decode base64 content
    let file_content = base64.decode(base64_content)
        .map_err(|e| format!("Failed to decode base64 content: {}", e))?;
    
    // Create temporary file
    let storage_path = libqaul::storage::Storage::get_path();
    let temp_dir = std::path::Path::new(&storage_path)
        .join(user_account.id.to_base58())
        .join("temp");
    
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    let temp_file_path = temp_dir.join(&final_file_name);
    
    // Write file content to temporary file
    let mut temp_file = std::fs::File::create(&temp_file_path)
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;
    
    temp_file.write_all(&file_content)
        .map_err(|e| format!("Failed to write file content: {}", e))?;
    
    temp_file.sync_all()
        .map_err(|e| format!("Failed to sync file: {}", e))?;
    
    // Use libqaul's ChatFile to send the file
    ChatFile::send(
        &user_account,
        &group_id.to_vec(),
        temp_file_path.to_string_lossy().to_string(),
        file_description.to_string(),
    ).map_err(|e| format!("Failed to send file: {}", e))?;
    
    // Clean up temporary file
    let _ = std::fs::remove_file(&temp_file_path);
    
    Ok(())
}
/// Read a file and return its contents as base64
///
/// # Arguments
/// * `file_path` - The path to the file to read
///
/// # Returns
/// * `Ok(base64_string)` - The file contents encoded as base64
/// * `Err(error)` - Error message if reading fails
#[tauri::command]
pub async fn read_file_as_base64(file_path: String) -> GroupResult<String> {
    use std::fs;
    use std::io::Read;
    
    // Read the file
    let mut file = fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file '{}': {}", file_path, e))?;
    
    // Read file contents
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))?;
    
    // Encode to base64
    let base64_string = base64.encode(buffer);
    
    Ok(base64_string)
}

// Helper function to decode chat content and determine message type
fn decode_chat_content_with_type(content: &[u8]) -> (String, String) {
    use prost::Message;
    
    match rpc_proto::ChatContentMessage::decode(content) {
        Ok(chat_msg) => {
            match chat_msg.message {
                Some(rpc_proto::chat_content_message::Message::ChatContent(content)) => {
                    (content.text.clone(), "text".to_string())
                }
                Some(rpc_proto::chat_content_message::Message::FileContent(_)) => {
                    ("<file message>".to_string(), "file".to_string())
                }
                Some(rpc_proto::chat_content_message::Message::GroupEvent(group_event)) => {
                    (format_group_event(&group_event), "system".to_string())
                }
                None => ("<empty message>".to_string(), "system".to_string()),
            }
        }
        Err(_) => {
            // Fallback for non-protobuf data
            match String::from_utf8(content.to_vec()) {
                Ok(text) => (text, "text".to_string()),
                Err(_) => (format!("<binary data: {} bytes>", content.len()), "binary".to_string()),
            }
        }
    }
}

/// Get total unread message count across all groups
///
/// # Returns
/// * `Ok(count)` - Total unread message count
/// * `Err(error)` - Error message if operation fails
#[tauri::command]
pub async fn get_total_unread_count() -> GroupResult<u32> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    let total_unread = libqaul::services::group::GroupStorage::group_get_total_unread_count(account_id);
    Ok(total_unread)
}

/// Delete specific messages by their IDs
///
/// # Arguments
/// * `message_ids` - Array of message IDs to delete
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(error)` - Error message if deletion fails
#[tauri::command]
pub async fn delete_messages(message_ids: Vec<String>) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    // Convert string message IDs to Vec<u8> format expected by storage
    let message_ids_bytes: Result<Vec<Vec<u8>>, _> = message_ids
        .into_iter()
        .map(|id| hex::decode(&id).map_err(|e| format!("Invalid message ID format: {}", e)))
        .collect();

    let message_ids_bytes = message_ids_bytes.map_err(|e| format!("Failed to decode message IDs: {}", e))?;

    libqaul::services::chat::ChatStorage::delete_messages(&account_id, &message_ids_bytes);
    Ok(())
}

/// Delete all messages in a specific group
///
/// # Arguments
/// * `group_id` - The group ID (hex string) to delete messages from
///
/// # Returns
/// * `Ok(())` - Success
/// * `Err(error)` - Error message if deletion fails
#[tauri::command]
pub async fn delete_all_group_messages(group_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user.id;

    // Convert hex string group ID to Vec<u8>
    let group_id_bytes = hex::decode(&group_id).map_err(|e| format!("Invalid group ID format: {}", e))?;

    // Delete all messages in the group
    libqaul::services::chat::ChatStorage::delete_all_group_messages(&account_id, &group_id_bytes);
    
    // Also remove the group itself from group storage
    libqaul::services::group::GroupStorage::remove_group(account_id, &group_id_bytes);
    
    Ok(())
}

pub fn register_commands<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("group")
        .invoke_handler(tauri::generate_handler![
            create_group,
            create_direct_chat,
            get_group_info,
            get_group_list,
            rename_group,
            get_pending_invitations,
            get_new_message_id,
            invite_user_to_group,
            reply_to_group_invitation,
            remove_user_from_group,
            leave_group,
            get_messages,
            send_message,
            read_file_as_base64,
            get_total_unread_count,
            delete_messages,
            delete_all_group_messages,
        ])
        .build()
}
