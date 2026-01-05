// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Network Mapping Functions
//!
//! This module exposes functions for mapping between node peer IDs and user IDs
//! in the qaul network routing system.

use libp2p::PeerId;
use serde::{Deserialize, Serialize};

use super::table::{RoutingTable, RoutingConnectionEntry};
use super::users::Users;
use crate::utilities::qaul_id::QaulId;

/// Network mapping information for a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMapping {
    /// User's peer ID
    pub peer_id: String,
    /// User's q8id (8-byte qaul ID)
    pub q8id: String,
    /// User's name
    pub name: String,
    /// Whether user is online
    pub is_online: bool,
    /// Connection information if online
    pub connections: Vec<ConnectionInfo>,
}

/// Connection information for reaching a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    /// Connection module type
    pub module: i32,
    /// Node ID via which user can be reached
    pub via_node: String,
    /// Hop count
    pub hop_count: u8,
    /// Round trip time
    pub rtt: u32,
}

/// Get network mapping for a specific user by peer ID
pub fn get_user_mapping(peer_id: &str) -> Option<NetworkMapping> {
    let peer_id = match PeerId::from_bytes(&bs58::decode(peer_id).into_vec().ok()?) {
        Ok(id) => id,
        Err(_) => return None,
    };

    let q8id = QaulId::to_q8id(peer_id.clone());
    let user = Users::get_user_by_q8id(q8id.clone())?;
    
    let online_users_info = RoutingTable::get_online_users_info();
    let is_online = online_users_info.contains_key(&q8id);
    
    let mut connections = Vec::new();
    if is_online {
        if let Some(entries) = online_users_info.get(&q8id) {
            for entry in entries {
                connections.push(ConnectionInfo {
                    module: entry.module.as_int(),
                    via_node: bs58::encode(entry.node.to_bytes()).into_string(),
                    hop_count: entry.hc,
                    rtt: entry.rtt,
                });
            }
        }
    }

    Some(NetworkMapping {
        peer_id: peer_id.to_base58(),
        q8id: bs58::encode(q8id).into_string(),
        name: user.name,
        is_online,
        connections,
    })
}

/// Get network mapping for all users
pub fn get_all_user_mappings() -> Vec<NetworkMapping> {
    let mut mappings = Vec::new();
    
    let users = Users::get_all_users();
    let online_users_info = RoutingTable::get_online_users_info();
    
    for user in users {
        let q8id = QaulId::to_q8id(user.id.clone());
        let is_online = online_users_info.contains_key(&q8id);
        
        let mut connections = Vec::new();
        if is_online {
            if let Some(entries) = online_users_info.get(&q8id) {
                for entry in entries {
                    connections.push(ConnectionInfo {
                        module: entry.module.as_int(),
                        via_node: bs58::encode(entry.node.to_bytes()).into_string(),
                        hop_count: entry.hc,
                        rtt: entry.rtt,
                    });
                }
            }
        }

        mappings.push(NetworkMapping {
            peer_id: user.id.to_base58(),
            q8id: bs58::encode(q8id).into_string(),
            name: user.name,
            is_online,
            connections,
        });
    }
    
    mappings
}

/// Get routing information for a specific user
pub fn get_user_routing(peer_id: &str) -> Option<RoutingConnectionEntry> {
    let peer_id = match PeerId::from_bytes(&bs58::decode(peer_id).into_vec().ok()?) {
        Ok(id) => id,
        Err(_) => return None,
    };
    
    RoutingTable::get_route_to_user(peer_id)
}

/// Get public key for a user by peer ID
pub fn get_user_public_key(peer_id: &str) -> Option<String> {
    let peer_id = match PeerId::from_bytes(&bs58::decode(peer_id).into_vec().ok()?) {
        Ok(id) => id,
        Err(_) => return None,
    };
    
    if let Some(public_key) = Users::get_pub_key(&peer_id) {
        let (_key_type, key_base58) = Users::get_protobuf_public_key(public_key);
        Some(key_base58)
    } else {
        None
    }
}

/// Get online users only
pub fn get_online_users() -> Vec<NetworkMapping> {
    get_all_user_mappings().into_iter()
        .filter(|mapping| mapping.is_online)
        .collect()
}

/// Get offline users only
pub fn get_offline_users() -> Vec<NetworkMapping> {
    get_all_user_mappings().into_iter()
        .filter(|mapping| !mapping.is_online)
        .collect()
}

/// Convert peer ID to q8id
pub fn peer_id_to_q8id(peer_id: &str) -> Option<String> {
    let peer_id = match PeerId::from_bytes(&bs58::decode(peer_id).into_vec().ok()?) {
        Ok(id) => id,
        Err(_) => return None,
    };
    
    let q8id = QaulId::to_q8id(peer_id);
    Some(bs58::encode(q8id).into_string())
}

/// Convert q8id to peer ID
pub fn q8id_to_peer_id(q8id: &str) -> Option<String> {
    let q8id_bytes = bs58::decode(q8id).into_vec().ok()?;
    let peer_id = Users::get_user_id_by_q8id(q8id_bytes)?;
    Some(peer_id.to_base58())
}
