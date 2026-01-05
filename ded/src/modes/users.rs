// Copyright (c) 2021 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Users functions
//!
//! Request and get

use prost::Message;
use uuid::Uuid;

use super::rpc::Rpc;

/// include generated protobuf RPC rust definition file
mod proto {
    include!("../../../modules/libqaul/src/router/qaul.rpc.users.rs");
}

/// users function handling
pub struct Users {}

impl Users {
    /// CLI command interpretation
    ///
    /// The CLI commands of users are processed here
    pub fn cli(command: &str) {
        match command {
            // request list of all users
            cmd if cmd.starts_with("list") => {
                Self::request_user_list();
            }
            cmd if cmd.starts_with("online") => {
                Self::request_online_user_list();
            }
            // verify a user
            cmd if cmd.starts_with("verify ") => {
                let user_id = cmd.strip_prefix("verify ").unwrap();

                Self::send_user_update(user_id, true, false);
            }
            // block a user
            cmd if cmd.starts_with("block ") => {
                let user_id = cmd.strip_prefix("block ").unwrap();

                Self::send_user_update(user_id, false, true);
            }
            // security number for a user
            cmd if cmd.starts_with("secure ") => {
                let user_id = cmd.strip_prefix("secure ").unwrap();
                Self::send_user_secure_number(user_id);
            }
            // refresh user names from routing table
            cmd if cmd.starts_with("refresh") => {
                Self::send_refresh_user_names();
            }
            // update user information
            cmd if cmd.starts_with("update ") => {
                let params = cmd.strip_prefix("update ").unwrap();
                let parts: Vec<&str> = params.splitn(3, ' ').collect();
                if parts.len() >= 2 {
                    let user_id = parts[0];
                    let name = parts[1];
                    let verified = parts.get(2).map(|&v| v == "verified").unwrap_or(false);
                    Self::send_user_info_update(user_id, name, verified, false);
                } else {
                    println!("Usage: users update <user_id> <name> [verified]");
                }
            }
            // unknown command
            _ => log::error!("unknown users command"),
        }
    }

    /// create rpc request for user list
    fn request_user_list() {
        // create request message
        let proto_message = proto::Users {
            message: Some(proto::users::Message::UserRequest(proto::UserRequest {})),
        };

        // encode message
        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");

        // send message
        Rpc::send_message(
            buf,
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );
    }

    fn request_online_user_list() {
        // create request message
        let proto_message = proto::Users {
            message: Some(proto::users::Message::UserOnlineRequest(
                proto::UserOnlineRequest {},
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
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );
    }

    /// create rpc user security number message
    fn send_user_secure_number(user_id_base58: &str) {
        let user_id = bs58::decode(user_id_base58).into_vec().unwrap();

        // create request message
        let proto_message = proto::Users {
            message: Some(proto::users::Message::SecurityNumberRequest(
                proto::SecurityNumberRequest { user_id },
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
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );
    }

    /// create rpc user update message
    fn send_user_update(user_id_base58: &str, verified: bool, blocked: bool) {
        let user_id = bs58::decode(user_id_base58).into_vec().unwrap();

        // create request message
        let proto_message = proto::Users {
            message: Some(proto::users::Message::UserUpdate(proto::UserEntry {
                name: String::from(""),
                id: user_id,
                key_base58: String::from(""),
                group_id: Vec::new(),
                connectivity: 0,
                verified,
                blocked,
                connections: vec![],
                profile_pic: None,
                about: None,
                reg_no: None,
                college: None,
            })),
        };

        // encode message
        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");

        // send message
        Rpc::send_message(
            buf,
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );
    }

    /// send user information update with name
    fn send_user_info_update(user_id_base58: &str, name: &str, verified: bool, blocked: bool) {
        let user_id = bs58::decode(user_id_base58).into_vec().unwrap();

        println!("Updating user {} with name '{}'", user_id_base58, name);

        // create request message
        let proto_message = proto::Users {
            message: Some(proto::users::Message::UserUpdate(proto::UserEntry {
                name: name.to_string(),
                id: user_id,
                key_base58: String::from(""),
                group_id: Vec::new(),
                connectivity: 0,
                verified,
                blocked,
                connections: vec![],
                profile_pic: None,
                about: None,
                reg_no: None,
                college: None,
            })),
        };

        // encode message
        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");

        // send message
        Rpc::send_message(
            buf,
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );

        println!("User update sent for {}", user_id_base58);
    }

    /// send request to refresh user names from routing table
    pub fn send_refresh_user_names() {
        println!("Refreshing user names from routing table...");

        // Use UserRequest as a trigger - this will also refresh user names
        // when processed by the router
        let proto_message = proto::Users {
            message: Some(proto::users::Message::UserRequest(proto::UserRequest {})),
        };

        // encode message
        let mut buf = Vec::with_capacity(proto_message.encoded_len());
        proto_message
            .encode(&mut buf)
            .expect("Vec<u8> provides capacity as needed");

        // send message
        Rpc::send_message(
            buf,
            super::rpc::proto::Modules::Users.into(),
            "".to_string(),
        );

        println!("Refresh request sent. Use 'users list' to see updated names.");
    }

    /// Process received RPC message
    ///
    /// Decodes received protobuf encoded binary RPC message
    /// of the users module.
    pub fn rpc(data: Vec<u8>) {
        match proto::Users::decode(&data[..]) {
            Ok(users) => match users.message {
                Some(proto::users::Message::UserList(proto_userlist)) => {
                    let mut line = 1;
                    println!("");
                    println!("All known Users");
                    println!("No. | User Name | User Id | Veryfied | Blocked | Connectivity");
                    println!("    | Group ID | Public Key");

                    for user in proto_userlist.user {
                        let mut verified = "N";
                        let mut blocked = "N";
                        let mut onlined = "Offline";

                        if user.verified {
                            verified = "Y";
                        }
                        if user.blocked {
                            blocked = "Y";
                        }
                        if user.connectivity == 1 {
                            onlined = "Online";
                        }
                        println!(
                            "{} | {} | {:?} | {} | {} | {}",
                            line,
                            user.name,
                            bs58::encode(user.id).into_string(),
                            verified,
                            blocked,
                            onlined
                        );
                        let group_uuid;
                        match Uuid::from_slice(&user.group_id) {
                            Ok(uuid) => {
                                group_uuid = uuid;
                                println!(
                                    "   | {} | {}",
                                    group_uuid.hyphenated().to_string(),
                                    user.key_base58
                                );
                            }
                            Err(e) => log::error!("{}", e),
                        }

                        // Display additional user information if available
                        if let Some(ref profile_pic) = user.profile_pic {
                            println!("   | Profile Picture: {}", profile_pic);
                        }
                        if let Some(ref about) = user.about {
                            println!("   | About: {}", about);
                        }
                        if let Some(ref reg_no) = user.reg_no {
                            println!("   | Registration Number: {}", reg_no);
                        }

                        if user.connections.len() > 0 {
                            println!("  Connections: module | hc | rtt | via");
                            for cnn in user.connections {
                                let module = proto::ConnectionModule::try_from(cnn.module)
                                    .unwrap()
                                    .as_str_name();
                                println!(
                                    "      {} | {} | {} | {}",
                                    module,
                                    cnn.hop_count,
                                    cnn.rtt,
                                    bs58::encode(cnn.via.clone()).into_string()
                                );
                            }
                        }
                        line += 1;
                    }

                    println!("");
                }
                Some(proto::users::Message::SecurityNumberResponse(resp)) => {
                    println!("Security Number:");
                    let mut counter = 0;
                    for number in resp.security_number_blocks {
                        print!("{:#05} ", number);
                        if counter == 3 {
                            println!("");
                        }
                        counter = counter + 1;
                    }
                    println!("");
                }
                Some(proto::users::Message::UserUpdate(user)) => {
                    let mut verified = "N";
                    let mut blocked = "N";
                    let mut onlined = "Offline";

                    if user.verified {
                        verified = "Y";
                    }
                    if user.blocked {
                        blocked = "Y";
                    }
                    if user.connectivity == 1 {
                        onlined = "Online";
                    }
                    println!("User updated: {} | {} | verified: {} | blocked: {} | {}", 
                        user.name, 
                        bs58::encode(user.id).into_string(),
                        verified,
                        blocked,
                        onlined
                    );
                }
                Some(proto::users::Message::UserRequest(_)) |
                Some(proto::users::Message::UserOnlineRequest(_)) |
                Some(proto::users::Message::SecurityNumberRequest(_)) => {
                    // These are request messages and can be ignored when received
                }
                _ => {
                    log::error!("unprocessable RPC users message");
                }
            },
            Err(error) => {
                log::error!("{:?}", error);
            }
        }
    }
}
