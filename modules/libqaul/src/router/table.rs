// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Global Routing Table
//!
//! This file contains the global routing table
//!
//! * contains all currently reachable users.
//! * There is an entry for each user over which connection modules
//!   it can be reached. Each connection module only contains
//!   information of the best node.

use super::proto;
use crate::connections::ConnectionModule;
use crate::node::user_accounts::UserAccounts;
use crate::router::router_net_proto;
use crate::router::users::Users;
use crate::router::users::USERS;
use crate::rpc::Rpc;
use crate::utilities::qaul_id::QaulId;
use libp2p::PeerId;
use prost::Message;
use serde::{Deserialize, Serialize};
use state::InitCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;

/// mutable state of table
static ROUTINGTABLE: InitCell<RwLock<RoutingTable>> = InitCell::new();

/// static flag to control routing table logging
static LOGGING_ENABLED: AtomicBool = AtomicBool::new(false);

/// table entry per user
#[derive(Debug, Clone)]
pub struct RoutingUserEntry {
    /// user q8id, 8 Byte qaul user id
    #[allow(dead_code)]
    pub id: Vec<u8>,
    /// propagation id
    pub pgid: u32,
    /// propagation id update time
    pub pgid_update: u64,
    /// shortest hop count for user within this propagation id
    #[allow(dead_code)]
    pub pgid_update_hc: u8,
    //online time
    pub online_time: u64,
    /// best routing entry per connection module
    pub connections: Vec<RoutingConnectionEntry>,
}

/// connection entry per connection module
#[derive(Debug, Clone)]
pub struct RoutingConnectionEntry {
    /// connections module
    pub module: ConnectionModule,
    /// node id
    /// via which the user can be reached
    pub node: PeerId,
    /// round trip time
    /// addition of all round trip times for all hops
    pub rtt: u32,
    /// hop count
    /// how many hops has the connection
    pub hc: u8,
    /// link quality
    pub lq: u32,
    /// last_update
    pub last_update: u64,
}

/// Serializable connection data for JSON output
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConnectionData {
    pub module: i32,
    pub hop_count: u32,
    pub rtt: u32,
    pub via: String,
}

/// Base user data structure with common fields
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BaseUserData {
    pub q8id: String,
    pub id: String,
    pub name: String,
    pub key_base58: String,
    pub verified: bool,
    pub blocked: bool,
    pub profile: Option<String>,
    pub about: Option<String>,
    pub college: Option<String>,
}

/// Online user data with connection information
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OnlineUserData {
    #[serde(flatten)]
    pub base: BaseUserData,
    pub connections: Vec<ConnectionData>,
}

/// Offline user data (no connection information)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OfflineUserData {
    #[serde(flatten)]
    pub base: BaseUserData,
}

/// All user data with connectivity status
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AllUserData {
    #[serde(flatten)]
    pub base: BaseUserData,
    pub connectivity: i32,
    pub connections: Vec<ConnectionData>,
}

/// Global Routing Table Implementation
///
/// This is the table to turn to when checking where to send
/// a package.
pub struct RoutingTable {
    /// routing table key is a users q8id
    pub table: HashMap<Vec<u8>, RoutingUserEntry>,
}

impl RoutingTable {
    /// Initialize routing table
    /// Creates global routing table and saves it to state.
    pub fn init() {
        // create global routing table and save it to state
        let table = RoutingTable {
            table: HashMap::new(),
        };
        ROUTINGTABLE.set(RwLock::new(table));
    }

    /// set and replace routing table with a new table
    pub fn set(new_table: RoutingTable) {
        let mut table = ROUTINGTABLE.get().write().unwrap();
        table.table = new_table.table;
    }

    /// Create routing information for a specific neighbour node,
    /// to be sent to this neighbour node.
    pub fn create_routing_info(
        neighbour: PeerId,
        last_sent: u64,
    ) -> router_net_proto::RoutingInfoTable {
        let mut table = router_net_proto::RoutingInfoTable { entry: Vec::new() };

        // get access to routing table
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // loop through routing table
        for (user_id, user) in routing_table.table.iter() {
            if user.connections.len() == 0 {
                continue;
            }

            // choose best link quality
            let mut min_conn = user.connections[0].clone();
            for i in 0..user.connections.len() {
                if user.connections[i].lq < min_conn.lq {
                    min_conn = user.connections[i].clone();
                }
            }

            if neighbour != min_conn.node && (min_conn.last_update >= last_sent || min_conn.hc == 0)
            {
                let mut hc = Vec::new();
                hc.push(min_conn.hc);

                let table_entry = router_net_proto::RoutingInfoEntry {
                    user: user_id.to_owned(),
                    rtt: min_conn.rtt,
                    hc,
                    pgid: user.pgid,
                };
                table.entry.push(table_entry);
            }
        }

        table
    }

    /// get online users and hope count    
    pub fn get_online_users_info() -> BTreeMap<Vec<u8>, Vec<RoutingConnectionEntry>> {
        let mut users: BTreeMap<Vec<u8>, Vec<RoutingConnectionEntry>> = BTreeMap::new();

        // get access to routing table
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // loop through routing table
        for (user_id, user) in routing_table.table.iter() {
            if user.connections.len() > 0 {
                users.insert(user_id.clone(), user.connections.clone());
            }
        }
        users
    }

    /// get offline user IDs only
    pub fn get_offline_user_ids() -> Vec<Vec<u8>> {
        let mut user_ids: Vec<Vec<u8>> = vec![];

        // get access to routing table
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // loop through routing table
        for (user_id, user) in routing_table.table.iter() {
            if user.connections.len() == 0 {
                user_ids.push(user_id.clone());
            }
        }
        user_ids
    }

    /// Create routing information for a specific neighbour node,
    /// to be sent to this neighbour node.
    pub fn get_online_user_ids(last_sent: u64) -> Vec<Vec<u8>> {
        let mut user_ids: Vec<Vec<u8>> = vec![];

        // get access to routing table
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // loop through routing table
        for (user_id, user) in routing_table.table.iter() {
            if user.online_time >= last_sent {
                user_ids.push(user_id.clone());
            }
        }
        user_ids
    }

    /// send protobuf RPC neighbours list
    pub fn rpc_send_routing_table() {
        // create list
        let mut table_list: Vec<proto::RoutingTableEntry> = Vec::new();

        // get routing table state
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // loop through all user table entries
        for (id, entry) in &routing_table.table {
            let mut table_entry = proto::RoutingTableEntry {
                user_id: id.to_owned(),
                connections: Vec::new(),
            };

            // loop through all connection entries in a user entry
            for connection in &entry.connections {
                // check module
                let module: i32;
                match connection.module {
                    ConnectionModule::Lan => module = proto::ConnectionModule::Lan as i32,
                    ConnectionModule::Internet => module = proto::ConnectionModule::Internet as i32,
                    ConnectionModule::Ble => module = proto::ConnectionModule::Ble as i32,
                    ConnectionModule::Local => module = proto::ConnectionModule::Local as i32,
                    _ => module = proto::ConnectionModule::None as i32,
                }

                // create entry
                table_entry.connections.push(proto::RoutingTableConnection {
                    module,
                    rtt: connection.rtt,
                    hop_count: connection.hc as u32,
                    via: connection.node.to_bytes(),
                });
            }

            // add user entry to table list
            table_list.push(table_entry);
        }

        // create table list message
        let proto_message = proto::Router {
            message: Some(proto::router::Message::RoutingTable(
                proto::RoutingTableList {
                    routing_table: table_list,
                },
            )),
        };

        // encode message
        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");

        // send message
        Rpc::send_message(
            buf,
            crate::rpc::proto::Modules::Router.into(),
            "".to_string(),
            Vec::new(),
        );
    }

    /// Get the routing connection entry for a specific user
    ///
    /// The connection entry for the provided user_id contains
    /// the neighbour id as well as the connection module via
    /// which to send the packages.
    ///
    /// It selects the best route according to the rank_routing_connection function.
    ///
    pub fn get_route_to_user(user_id: PeerId) -> Option<RoutingConnectionEntry> {
        // get routing table state
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // get q8id for qaul user
        let user_q8id = QaulId::to_q8id(user_id);

        // find user
        if let Some(user_entry) = routing_table.table.get(&user_q8id) {
            let mut compare: Option<&RoutingConnectionEntry> = None;

            // find best route
            for connection in &user_entry.connections {
                match compare {
                    Some(current) => {
                        if Self::compare_connections(current, connection) {
                            compare = Some(connection);
                        }
                    }
                    None => compare = Some(connection),
                }
            }

            // return route
            match compare {
                None => return None,
                Some(connection) => return Some(connection.to_owned()),
            }
        }
        None
    }

    /// Compare two routing connections and decides which one is better
    ///
    /// This function decides which connection to favour based on the
    /// rank_routing_connection function
    ///
    /// Return values:
    ///
    /// * returns true, when the new connection is better
    /// * returns false, when the current connection is better
    ///
    fn compare_connections(current: &RoutingConnectionEntry, new: &RoutingConnectionEntry) -> bool {
        let current_value = Self::rank_routing_connection(current);
        let new_value = Self::rank_routing_connection(new);

        if current_value < new_value {
            return true;
        }

        false
    }

    /// log routing table each second    
    pub fn log_routing_table() {
        // check if logging is enabled
        if !LOGGING_ENABLED.load(Ordering::Relaxed) {
            return;
        }

        use crate::router::users::Users;

        // get access to routing table
        let routing_table = ROUTINGTABLE.get().read().unwrap();

        // log routing table status
        log::info!("ROUTING TABLE LOG: {} entries", routing_table.table.len());

        // log detailed entries
        for (user_id, user) in routing_table.table.iter() {
            // try to get user name from users table
            let user_name = Users::get_user_name_by_q8id(user_id.clone());

            match user_name {
                Some(name) => {
                    log::info!(
                        "  User: {} ({})",
                        name,
                        user.connections.first().map(|c| c.hc).unwrap_or(255)
                    );
                }
                None => {
                    // fallback to showing q8id in hex if no name found
                    log::info!(
                        "  Unknown user [{:x?}], Connections: {}, Best hop: {}",
                        user_id,
                        user.connections.len(),
                        user.connections.first().map(|c| c.hc).unwrap_or(255)
                    );
                }
            }
        }
    }

    /// enable routing table logging
    pub fn enable_logging() {
        LOGGING_ENABLED.store(true, Ordering::Relaxed);
        log::info!("Routing table logging ENABLED");
    }

    /// disable routing table logging
    pub fn disable_logging() {
        LOGGING_ENABLED.store(false, Ordering::Relaxed);
        log::info!("Routing table logging DISABLED");
    }

    /// give a ranking to the routing connection
    ///
    /// This function decides which connection to favour based on the following qualities:
    ///
    /// * Hierarchy of connection modules in the following order:
    ///   Local, LAN, Internet, BLE, None
    ///
    fn rank_routing_connection(connection: &RoutingConnectionEntry) -> u8 {
        match connection.module {
            ConnectionModule::None => return 0,
            ConnectionModule::Ble => return 1,
            ConnectionModule::Internet => return 2,
            ConnectionModule::Lan => return 3,
            ConnectionModule::Local => return 4,
        }
    }

    /// Get all online users with their details
    /// Returns a JSON string of online users, excluding the current user
    pub fn get_online_users() -> String {
        let mut online_users_list = Vec::new();

        // Get users store
        let users = USERS.get().read().unwrap();

        // Get all online user ids (passing 0 to get all)
        let online_user_ids = RoutingTable::get_online_user_ids(0);

        // Get online users info with routing details
        let online_users_info = RoutingTable::get_online_users_info();

        // Get current user to exclude from the list
        let current_user_id = if let Some(account) = UserAccounts::get_default_user() {
            Some(account.id.clone())
        } else {
            None
        };

        // Iterate through online user ids
        for q8id in &online_user_ids {
            if let Some(user) = users.users.get(q8id) {
                // Skip if this is the current user
                if let Some(ref current_id) = current_user_id {
                    if user.id == *current_id {
                        continue;
                    }
                }

                let mut connections: Vec<ConnectionData> = Vec::new();

                // Get connection details if available
                if let Some(entries) = online_users_info.get(q8id) {
                    for entry in entries {
                        connections.push(ConnectionData {
                            module: entry.module.as_int(),
                            hop_count: entry.hc as u32,
                            rtt: entry.rtt,
                            via: bs58::encode(entry.node.to_bytes()).into_string(),
                        });
                    }
                }

                // Get key in base58 format
                let (_key_type, key_base58) = Users::get_protobuf_public_key(user.key.clone());

                // Create serializable user data
                let user_data = OnlineUserData {
                    base: BaseUserData {
                        q8id: bs58::encode(q8id).into_string(),
                        id: user.id.to_base58(),
                        name: user.name.clone(),
                        key_base58,
                        verified: user.verified,
                        blocked: user.blocked,
                        profile: user.profile_pic.clone(),
                        about: user.about.clone(),
                        college: user.college.clone().or_else(|| user.reg_no.clone()),
                    },
                    connections,
                };

                online_users_list.push(user_data);
            }
        }

        serde_json::to_string(&online_users_list).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get all offline users with their details
    /// Returns a JSON string of offline users, excluding the current user
    pub fn get_offline_users() -> String {
        let mut offline_users_list = Vec::new();

        // Get users store
        let users = USERS.get().read().unwrap();

        // Get all online user ids
        let online_user_ids = RoutingTable::get_online_user_ids(0);

        // Convert online_user_ids to a HashSet for faster lookup
        let online_ids_set: HashSet<_> = online_user_ids.into_iter().collect();

        // Get current user to exclude from the list
        let current_user_id = if let Some(account) = UserAccounts::get_default_user() {
            Some(account.id.clone())
        } else {
            None
        };

        // Iterate through all users and filter offline ones
        for (q8id, user) in &users.users {
            // Skip if this is the current user
            if let Some(ref current_id) = current_user_id {
                if user.id == *current_id {
                    continue;
                }
            }

            if !online_ids_set.contains(q8id) {
                // Get key in base58 format
                let (_key_type, key_base58) = Users::get_protobuf_public_key(user.key.clone());

                // Create serializable user data
                let user_data = OfflineUserData {
                    base: BaseUserData {
                        q8id: bs58::encode(q8id).into_string(),
                        id: user.id.to_base58(),
                        name: user.name.clone(),
                        key_base58,
                        verified: user.verified,
                        blocked: user.blocked,
                        profile: user.profile_pic.clone(),
                        about: user.about.clone(),
                        college: user.college.clone().or_else(|| user.reg_no.clone()),
                    },
                };

                offline_users_list.push(user_data);
            }
        }

        serde_json::to_string(&offline_users_list).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get all users (both online and offline) with their details
    /// Returns a JSON string of all users with connectivity status, excluding the current user
    pub fn get_all_users() -> String {
        let mut all_users_list = Vec::new();

        // Get users store
        let users = USERS.get().read().unwrap();
        // Get online users info
        let online_users_info = RoutingTable::get_online_users_info();

        // Get current user to exclude from the list
        let current_user_id = if let Some(account) = UserAccounts::get_default_user() {
            Some(account.id.clone())
        } else {
            None
        };

        // Iterate through all users
        for (q8id, user) in &users.users {
            // Skip if this is the current user
            if let Some(ref current_id) = current_user_id {
                if user.id == *current_id {
                    continue;
                }
            }

            let mut connectivity: i32 = 0;
            let mut connections: Vec<ConnectionData> = Vec::new();

            // Check if user is online
            if let Some(entries) = online_users_info.get(q8id) {
                connectivity = 1;
                for entry in entries {
                    connections.push(ConnectionData {
                        module: entry.module.as_int(),
                        hop_count: entry.hc as u32,
                        rtt: entry.rtt,
                        via: bs58::encode(entry.node.to_bytes()).into_string(),
                    });
                }
            }

            // Get key in base58 format
            let (_key_type, key_base58) = Users::get_protobuf_public_key(user.key.clone());

            // Create serializable user data
            let user_data = AllUserData {
                base: BaseUserData {
                    q8id: bs58::encode(q8id).into_string(),
                    id: user.id.to_base58(),
                    name: user.name.clone(),
                    key_base58,
                    verified: user.verified,
                    blocked: user.blocked,
                    profile: user.profile_pic.clone(),
                    about: user.about.clone(),
                    college: user.college.clone().or_else(|| user.reg_no.clone()),
                },
                connectivity,
                connections,
            };

            all_users_list.push(user_data);
        }

        serde_json::to_string(&all_users_list).unwrap_or_else(|_| "[]".to_string())
    }
}
