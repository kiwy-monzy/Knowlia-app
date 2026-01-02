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
use libqaul::services::chat::storage::ChatStorage;
use libqaul::services::chat::rpc_proto;
use libqaul::services::chat::file;
use libqaul::services::chat::file::proto_rpc::FileHistoryRequest;
use libqaul::router::users::Users;
use base64::{engine::general_purpose::STANDARD as base64, Engine};
use libqaul::utilities::qaul_id::QaulId;
use libqaul::node::user_accounts::UserAccounts;

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

    let account_id = current_user;

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
    let user_peer_id = current_user;
    
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

    let account_id = current_user;

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
pub async fn get_group_info(group_id: Vec<u8>) -> GroupResult<GroupInfo> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user;

    let group_info = GroupManage::group_info(&account_id, &group_id)?;
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
            let account_id = current_user;
            let my_user_id = current_user;

            let group_list = GroupManage::group_list(&account_id);
            let groups: Vec<GroupInfo> = group_list.groups.into_iter().map(|g| {
                let mut group_info: GroupInfo = g.into();
                
                // Handle direct chat display names
                if group_info.is_direct_chat {
                    // Find the other member (not current user)
                    if let Some(other_member) = group_info.members.iter().find(|m| m.user_id != my_user_id.to_bytes()) {
                        // Try to get user name from Users database using the same logic as messages
                        let user_name = {
                            let peer_id = match PeerId::from_bytes(&other_member.user_id) {
                                Ok(id) => Some(id),
                                Err(_) => None,
                            };
                            
                            if let Some(id) = peer_id {
                                let user_q8id = QaulId::to_q8id(id.clone());
                                if let Some(user) = Users::get_user_by_q8id(user_q8id) {
                                    user.name
                                } else {
                                    // Fallback to member name if available
                                    if !other_member.name.is_empty() {
                                        other_member.name.clone()
                                    } else {
                                        // Final fallback to user ID truncated
                                        let user_id_str = bs58::encode(&other_member.user_id).into_string();
                                        format!("{}...", &user_id_str[..user_id_str.len().min(12)])
                                    }
                                }
                            } else {
                                // Fallback to member name if available
                                if !other_member.name.is_empty() {
                                    other_member.name.clone()
                                } else {
                                    // Final fallback to user ID truncated
                                    let user_id_str = bs58::encode(&other_member.user_id).into_string();
                                    format!("{}...", &user_id_str[..user_id_str.len().min(12)])
                                }
                            }
                        };
                        
                        group_info.group_name = user_name;
                    }
                } else {
                    // Handle regular groups
                    if group_info.group_name.is_empty() {
                        group_info.group_name = "Unnamed Group".to_string();
                    }
                }
                
                // Get file count and files for this group
                let group_files = get_group_files(&group_info.group_id);
                group_info.file_count = group_files.len() as u32;
                group_info.files = group_files;
                
                // Determine last message status
                group_info.last_message_status = if !group_info.last_message_sender_id.is_empty() {
                    // Check if the last message was sent by the current user
                    if group_info.last_message_sender_id == my_user_id.to_bytes() {
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
pub async fn rename_group(group_id: Vec<u8>, new_name: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user;

    GroupManage::rename_group(&account_id, &group_id, new_name)?;
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

    let account_id = current_user;

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
pub async fn get_new_message_id(group_id: Vec<u8>) -> GroupResult<Vec<u8>> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user;

    let message_id = GroupManage::get_new_message_id(&account_id, &group_id);

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
    pub group_id: Vec<u8>,
    pub group_name: String,
    pub created_at: u64,
    pub status: i32,
    pub revision: u32,
    pub is_direct_chat: bool,
    pub members: Vec<GroupMember>,
    pub unread_messages: u32,
    pub last_message_at: u64,
    pub last_message: String,
    pub last_message_sender_id: Vec<u8>,
    pub last_message_status: Option<String>,
    pub file_count: u32,
    pub files: Vec<FileHistory>,
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
            group_id: proto.group_id,
            group_name: proto.group_name,
            created_at: proto.created_at,
            status: proto.status,
            revision: proto.revision,
            is_direct_chat: proto.is_direct_chat,
            members: proto.members.into_iter().map(|m| m.into()).collect(),
            unread_messages: proto.unread_messages,
            last_message_at: proto.last_message_at,
            last_message: decode_last_message(&proto.last_message),
            last_message_sender_id: proto.last_message_sender_id,
            last_message_status: None, // Will be populated later
            file_count: 0, // Will be populated later
            files: vec![], // Will be populated later
        }
    }
}

impl From<ProtoGroupMember> for GroupMember {
    fn from(proto: ProtoGroupMember) -> Self {
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
        }
    }
}

impl From<libqaul::services::group::proto_rpc::GroupInvited> for GroupInvitation {
    fn from(proto: libqaul::services::group::proto_rpc::GroupInvited) -> Self {
        Self {
            sender_id: proto.sender_id,
            received_at: proto.received_at,
            group: proto.group.map(|g| g.into()).unwrap_or_else(|| GroupInfo {
                group_id: vec![],
                group_name: "Unknown Group".to_string(),
                created_at: 0,
                status: 0,
                revision: 0,
                is_direct_chat: false,
                members: vec![],
                unread_messages: 0,
                last_message_at: 0,
                last_message: String::new(),
                last_message_sender_id: vec![],
                last_message_status: None,
                file_count: 0,
                files: vec![],
            }),
        }
    }
}

impl From<libqaul::services::group::Group> for GroupInfo {
    fn from(group: libqaul::services::group::Group) -> Self {
        Self {
            group_id: group.id.clone(),
            group_name: group.name,
            created_at: group.created_at,
            status: group.status,
            revision: group.revision,
            is_direct_chat: group.is_direct_chat,
            members: group
                .members
                .values()
                .map(|m| GroupMember {
                    user_id: m.user_id.clone(),
                    role: m.role,
                    joined_at: m.joined_at,
                    state: m.state,
                    last_message_index: m.last_message_index,
                    name: m.name.clone(),
                    reg_no: m.reg_no.clone(),
                    profile_pic: m.profile_pic.clone(),
                    about: m.about.clone(),
                })
                .collect(),
            unread_messages: group.unread_messages,
            last_message_at: group.last_message_at,
            last_message: decode_last_message(&group.last_message_data),
            last_message_sender_id: group.last_message_sender_id,
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
pub async fn invite_user_to_group(group_id: Vec<u8>, user_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user;

    let invited_user_id = user_id
        .parse::<PeerId>()
        .map_err(|e| format!("Invalid invited user ID: {}", e))?;

    Member::invite(&account_id, &group_id, &invited_user_id)?;
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
pub async fn reply_to_group_invitation(group_id: Vec<u8>, accept: bool) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;

    let account_id = current_user;

    Member::reply_invite(&account_id, &group_id, accept)?;
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
pub async fn remove_user_from_group(group_id: Vec<u8>, user_id: String) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user;

    let target_user_id = user_id
        .parse::<PeerId>()
        .map_err(|e| format!("Invalid user ID: {}", e))?;

    Member::remove(&account_id, &group_id, &target_user_id)?;
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
pub async fn leave_group(group_id: Vec<u8>) -> GroupResult<()> {
    let current_user = get_current_user_internal().ok_or("No current user found")?;
    let account_id = current_user;

    Member::remove(&account_id, &group_id, &account_id)?;
    Ok(())
}

/// Get file history for a specific group
fn get_group_files(group_id: &[u8]) -> Vec<FileHistory> {
    // Get current user account
    let user_account = match get_current_user_internal() {
        Some(user) => {
            match UserAccounts::get_by_id(user) {
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
            // Get sender name from Users database
            let sender_name = {
                let peer_id = match PeerId::from_bytes(&file.sender_id) {
                    Ok(id) => Some(id),
                    Err(_) => None,
                };
                
                if let Some(id) = peer_id {
                    let user_q8id = QaulId::to_q8id(id.clone());
                    if let Some(user) = Users::get_user_by_q8id(user_q8id) {
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
        Some(user) => user,
        None => return Err("No current user found".to_string()),
    };
    
    // Log libqaul storage path for debugging
    let _storage_path = libqaul::storage::Storage::get_path();
    
    // Get current user's peer ID for comparison
    let current_peer_id_bytes = peer_id.to_bytes();
    
    // Parse hex string and convert to bytes
    let group_id_bytes = match hex::decode(&group_id) {
        Ok(bytes) => {
            log::info!("Successfully decoded group ID: {} bytes", bytes.len() as usize);
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
    let account_id = current_user;

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
    let account_id = current_user;

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
    let account_id = current_user;

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
    let account_id = current_user;

    // Convert hex string group ID to Vec<u8>
    let group_id_bytes = hex::decode(&group_id).map_err(|e| format!("Invalid group ID format: {}", e))?;

    // Delete all messages in the group
    libqaul::services::chat::ChatStorage::delete_all_group_messages(&account_id, &group_id_bytes);
    
    // Also remove the group itself from group storage
    libqaul::services::group::GroupStorage::remove_group(account_id, &group_id_bytes);
    
    Ok(())
}

/// Session information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub host_user_id: String,
    pub created_at: u64,
    pub users: Vec<String>,
    pub is_active: bool,
}

/// Create a new session (alias for create_group for compatibility)
#[tauri::command]
pub async fn create_session(name: String, host_user_id: String) -> Result<Session, String> {
    // For now, create a group and return it as a session
    let group_id = create_group(name.clone()).await?;
    let session_id = hex::encode(&group_id);
    
    Ok(Session {
        id: session_id,
        name,
        host_user_id: host_user_id.clone(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        users: vec![host_user_id],
        is_active: true,
    })
}

/// Join a session (alias for joining a group)
#[tauri::command]
pub async fn join_session(session_id: String, user_id: String) -> Result<(), String> {
    // Convert session_id (hex) to group_id bytes
    let _group_id_bytes = hex::decode(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    
    // For now, this is a placeholder - actual group joining would be handled differently
    log::info!("User {} joining session {}", user_id, session_id);
    Ok(())
}

/// Leave a session (alias for leave_group)
#[tauri::command]
pub async fn leave_session(session_id: String, user_id: String) -> Result<(), String> {
    // Convert session_id (hex) to group_id bytes
    let group_id_bytes = hex::decode(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    
    // Use the existing leave_group function
    leave_group(group_id_bytes).await?;
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
            create_session,
            join_session,
            leave_session,
        ])
        .build()
}
