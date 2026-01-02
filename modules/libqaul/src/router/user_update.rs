// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # User Update Module
//!
//! This module handles periodic user configuration updates:
//! - Checks config.yaml periodically for changes
//! - Sends user configuration to other nodes
//! - Processes received user configuration updates
//! - Updates local user table with received user data

use prost::Message;
use serde_json;
use state::InitCell;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::node::Node;
use crate::router::router_net_proto;
use crate::router::users::Users;
use crate::storage::configuration::Configuration;
use crate::utilities::qaul_id::QaulId;

/// mutable state for user update requests
static USERUPDATE_REQUESTER: InitCell<RwLock<UserUpdateRequester>> = InitCell::new();

/// User update request structure for sending to neighbours
#[derive(Debug, Clone)]
pub struct UserUpdateSendRequest {
    /// target neighbour node id
    pub neighbour_id: libp2p::PeerId,
    /// user update data to send
    pub data: Vec<u8>,
}

/// mutable state for user update send requests
static USERUPDATE_SEND_REQUESTER: InitCell<RwLock<UserUpdateSendRequester>> = InitCell::new();

/// User update send requester that manages sending user updates to neighbours
pub struct UserUpdateSendRequester {
    /// queue of user update requests to send
    pub to_send: std::collections::VecDeque<UserUpdateSendRequest>,
}

impl UserUpdateSendRequester {
    /// Initialize user update send requester
    pub fn init() {
        let requester = UserUpdateSendRequester {
            to_send: std::collections::VecDeque::new(),
        };
        USERUPDATE_SEND_REQUESTER.set(RwLock::new(requester));
    }

    /// Get user update send requester instance
    pub fn get() -> &'static InitCell<RwLock<UserUpdateSendRequester>> {
        &USERUPDATE_SEND_REQUESTER
    }

    /// Queue user update to be sent to a specific neighbour
    pub fn queue_user_update(neighbour_id: libp2p::PeerId, data: Vec<u8>) {
        let mut requester = USERUPDATE_SEND_REQUESTER.get().write().unwrap();

        let request = UserUpdateSendRequest { neighbour_id, data };
        requester.to_send.push_back(request);

        log::debug!("Queued user update for sending to {:?}", neighbour_id);
    }

    /// Process queued user update requests and return them for sending
    pub fn process_requests() -> Vec<UserUpdateSendRequest> {
        let mut requester = USERUPDATE_SEND_REQUESTER.get().write().unwrap();
        let mut requests_to_send = Vec::new();

        while let Some(request) = requester.to_send.pop_front() {
            requests_to_send.push(request);
        }

        requests_to_send
    }
}

/// User update request structure
#[derive(Debug, Clone)]
pub struct UserUpdateRequest {
    /// target neighbour node id
    pub neighbour_id: libp2p::PeerId,
    /// user configuration data
    pub user_data: Vec<u8>,
}

/// User update requester that manages sending user updates
pub struct UserUpdateRequester {
    /// queue of user update requests to send
    pub to_send: std::collections::VecDeque<UserUpdateRequest>,
}

impl UserUpdateRequester {
    /// Initialize user update requester
    pub fn init() {
        let requester = UserUpdateRequester {
            to_send: std::collections::VecDeque::new(),
        };
        USERUPDATE_REQUESTER.set(RwLock::new(requester));
    }

    /// Get user update requester instance
    pub fn get() -> &'static InitCell<RwLock<UserUpdateRequester>> {
        &USERUPDATE_REQUESTER
    }

    /// Queue user update to be sent to all neighbours
    pub fn queue_user_update(user_data: Vec<u8>) {
        // Create UserUpdate protobuf message with JSON data
        let user_update_proto = router_net_proto::UserUpdate {
            user_id: user_data,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        // Encode UserUpdate message
        let mut user_update_buf = Vec::with_capacity(user_update_proto.encoded_len());
        if let Err(e) = user_update_proto.encode(&mut user_update_buf) {
            log::error!("Failed to encode UserUpdate protobuf message: {}", e);
            return;
        }

        // Create RouterInfoContent with UserUpdate module type
        let node_id = crate::node::Node::get_id();
        let timestamp = crate::utilities::timestamp::Timestamp::get_timestamp();
        let router_info_content = router_net_proto::RouterInfoContent {
            id: node_id.to_bytes(),
            router_info_module: router_net_proto::RouterInfoModule::UserUpdate as i32,
            content: user_update_buf,
            time: timestamp,
        };

        // Encode RouterInfoContent
        let mut content_buf = Vec::with_capacity(router_info_content.encoded_len());
        if let Err(e) = router_info_content.encode(&mut content_buf) {
            log::error!("Failed to encode RouterInfoContent: {}", e);
            return;
        }

        // Sign the content
        let keys = crate::node::Node::get_keys();
        let signature = keys.sign(&content_buf).unwrap();

        // Create RouterInfoContainer
        let router_info_container = router_net_proto::RouterInfoContainer {
            signature,
            message: content_buf,
        };

        // Encode final container
        let mut final_buf = Vec::with_capacity(router_info_container.encoded_len());
        if let Err(e) = router_info_container.encode(&mut final_buf) {
            log::error!("Failed to encode RouterInfoContainer: {}", e);
            return;
        }

        // Use the connections module to send the properly wrapped message to all neighbours
        crate::connections::Connections::send_user_data_to_all(final_buf);
    }

    /// Process queued user update requests (deprecated - use UserUpdateSendRequester instead)
    pub fn process_requests() -> Vec<UserUpdateRequest> {
        // This function is kept for compatibility but the new UserUpdateSendRequester should be used
        log::warn!("Using deprecated UserUpdateRequester::process_requests - consider using UserUpdateSendRequester instead");
        Vec::new()
    }

    /// Create user update protobuf message
    #[allow(dead_code)]
    fn create_user_update_message(user_data: &[u8]) -> Vec<u8> {
        let proto_message = router_net_proto::UserUpdate {
            user_id: user_data.to_vec(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");
        buf
    }
}

/// Check for configuration changes and queue updates
pub fn check_config_changes() {
    // Get current configuration
    let config = Configuration::get();

    // Get local user information with extended profile data
    let (local_user_id, local_user_name, profile_pic, about, reg_no, college) =
        if let Some(account) = crate::node::user_accounts::UserAccounts::get_default_user() {
            // Only use active user accounts for router updates
            if account.active {
                let name = account.name.clone();
                let id = account.id.to_base58();
                log::info!(
                    "Extracted user name '{}' and ID '{}' from active default user account",
                    name,
                    id
                );
                (
                    id, 
                    name,
                    account.profile_pic.clone().unwrap_or_default(),
                    account.about.clone().unwrap_or_default(),
                    account.reg_no.clone().unwrap_or_default(),
                    account.college.clone().unwrap_or_default()
                )
            } else {
                log::warn!(
                    "Default user account '{}' is not active, skipping router update",
                    account.name
                );
                return;
            }
        } else {
            // Fallback to node ID if no user account exists
            let fallback_id = Node::get_id_string();
            let fallback_name = config.node.id.clone();
            log::warn!(
                "No user account found, using node ID '{}' and name '{}' as fallback",
                fallback_id,
                fallback_name
            );
            (fallback_id, fallback_name, String::new(), String::new(), String::new(), String::new())
        };

    // Create comprehensive user data payload with core and extended fields
    let user_data = serde_json::json!({
        "id": local_user_id,
        "name": local_user_name,
        "profile_pic": profile_pic,
        "about": about,
        "reg_no": reg_no,
        "college": college,
        "timestamp": SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });

    let user_data_bytes = match serde_json::to_vec(&user_data) {
        Ok(bytes) => bytes,
        Err(e) => {
            log::error!("Failed to serialize user data: {}", e);
            return;
        }
    };

    // Validate that we have valid data before sending
    if user_data_bytes.is_empty() {
        log::error!("Serialized user data is empty, skipping update");
        return;
    }

    // Queue user update for all neighbours
    UserUpdateRequester::queue_user_update(user_data_bytes);

    log::debug!(
        "Queued user configuration update for all neighbours with name: {}",
        local_user_name
    );
}

/// Process received user update message
pub fn process_user_update(data: Vec<u8>, from_peer_id: libp2p::PeerId) {
    // Validate data before attempting to decode
    if data.is_empty() {
        log::warn!("Received empty user update data from {:?}", from_peer_id);
        return;
    }

    match router_net_proto::UserUpdate::decode(&data[..]) {
        Ok(user_update) => {
            log::debug!("Received user update from {:?}", from_peer_id);

            // Parse comprehensive user data including extended fields
            if let Ok(user_data) = serde_json::from_slice::<serde_json::Value>(&user_update.user_id)
            {
                if let (Some(user_id), Some(user_name)) = (
                    user_data.get("id").and_then(|v| v.as_str()),
                    user_data.get("name").and_then(|v| v.as_str()),
                ) {
                    // Extract extended profile fields with defaults
                    let profile_pic = user_data.get("profile_pic")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let about = user_data.get("about")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let reg_no = user_data.get("reg_no")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let college = user_data.get("college")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    // Convert user_id string to PeerId
                    match QaulId::from_base58(user_id) {
                        Ok(qaul_id) => {
                            let q8id = QaulId::to_q8id(qaul_id);

                            // Update user in local table with all fields
                            Users::update_user_info_extended(
                                q8id,
                                user_name.to_string(),
                                profile_pic,
                                about,
                                reg_no,
                                college,
                                user_update.timestamp,
                            );

                            log::info!("Updated user info: {} ({}) with extended profile data", user_name, user_id);
                        }
                        Err(e) => {
                            log::error!("Invalid user ID format in update: {} - {}", user_id, e);
                        }
                    }
                } else {
                    log::error!("Missing required fields (id, name) in user update data");
                }
            } else {
                log::error!("Failed to parse user update JSON data");
            }
        }
        Err(error) => {
            log::error!("Failed to decode user update message: {:?}", error);
        }
    }
}
