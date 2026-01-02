// Copyright (c) 2022 Open Community Project Association https://ocpa.ch
// This software is published under the AGPLv3 license.

//! # Group Management

use libp2p::PeerId;
use std::collections::BTreeMap;

use super::group_id::GroupId;
use super::{Group, GroupInvited, GroupStorage};
use crate::node::UserAccounts;
use crate::services::chat::{self, Chat, ChatStorage};
use crate::utilities::timestamp::Timestamp;

/// Group Manage Structure
pub struct GroupManage {}
impl GroupManage {
    /// Get a group from the data base
    ///
    /// If it is a direct chat group, and does not yet exist
    /// this function will create a new direct chat group and
    /// return it.
    pub fn get_group_create_direct(
        account_id: PeerId,
        group_id: GroupId,
        remote_id: &PeerId,
    ) -> Option<Group> {
        // try to get group from data base
        match GroupStorage::get_group(account_id.clone(), group_id.to_bytes()) {
            Some(group) => return Some(group),
            None => {
                // check if it is the direct chat group for the connection
                if group_id == GroupId::from_peers(&account_id, remote_id) {
                    // create a new direct chat group
                    let group = Self::create_new_direct_chat_group(&account_id, &remote_id);
                    return Some(group);
                }
            }
        }

        None
    }

    /// Create a new direct chat group
    ///
    /// The function expects two qaul user ID's:
    ///
    /// * `account_id` your user account ID
    /// * `user_id` the user ID of the other user
    pub fn create_new_direct_chat_group(account_id: &PeerId, user_id: &PeerId) -> Group {
        let group_id = GroupId::from_peers(account_id, user_id).to_bytes();

        // check if group already exists
        if let Some(group) = GroupStorage::get_group(account_id.to_owned(), group_id.clone()) {
            return group;
        }

        // create new group
        let mut group = Group::new();
        group.members.insert(
            account_id.to_bytes(),
            super::GroupMember {
                user_id: account_id.to_bytes(),
                role: super::proto_rpc::GroupMemberRole::Admin.try_into().unwrap(),
                joined_at: Timestamp::get_timestamp(),
                state: super::proto_rpc::GroupMemberState::Activated
                    .try_into()
                    .unwrap(),
                last_message_index: 0,
                name: String::new(),
                reg_no: String::new(),
                profile_pic: String::new(),
                about: String::new(),
                college: String::new(),
            },
        );
        group.members.insert(
            user_id.to_bytes(),
            super::GroupMember {
                user_id: user_id.to_bytes(),
                role: super::proto_rpc::GroupMemberRole::Admin.try_into().unwrap(),
                joined_at: Timestamp::get_timestamp(),
                state: super::proto_rpc::GroupMemberState::Activated
                    .try_into()
                    .unwrap(),
                last_message_index: 0,
                name: String::new(),
                reg_no: String::new(),
                profile_pic: String::new(),
                about: String::new(),
                college: String::new(),
            },
        );

        group.id = group_id.clone();
        group.is_direct_chat = true;

        // save group to data base
        GroupStorage::save_group(account_id.to_owned(), group.clone());

        group
    }

    /// create new group from rpc command
    pub fn create_new_group(account_id: &PeerId, name: String) -> Vec<u8> {
        let mut group = Group::new();

        group.id = uuid::Uuid::new_v4().as_bytes().to_vec();

        group.members.insert(
            account_id.to_bytes(),
            super::GroupMember {
                user_id: account_id.to_bytes(),
                role: super::proto_rpc::GroupMemberRole::Admin.try_into().unwrap(),
                joined_at: Timestamp::get_timestamp(),
                state: super::proto_rpc::GroupMemberState::Activated as i32,
                last_message_index: 0,
                name: String::new(),
                reg_no: String::new(),
                profile_pic: String::new(),
                about: String::new(),
                college: String::new(),
            },
        );

        group.name = name;

        // save group
        GroupStorage::save_group(account_id.to_owned(), group.clone());

        // save group created event
        let event = chat::rpc_proto::ChatContentMessage {
            message: Some(chat::rpc_proto::chat_content_message::Message::GroupEvent(
                chat::rpc_proto::GroupEvent {
                    event_type: chat::rpc_proto::GroupEventType::Created as i32,
                    user_id: account_id.to_bytes(),
                },
            )),
        };

        ChatStorage::save_message(
            account_id,
            &GroupId::from_bytes(&group.id).unwrap(),
            account_id,
            &Vec::new(),
            Timestamp::get_timestamp(),
            event,
            chat::rpc_proto::MessageStatus::Received,
        );

        return group.id;
    }

    /// rename group from RPC command
    ///
    /// `account_id` the user account ID
    pub fn rename_group(
        account_id: &PeerId,
        group_id: &Vec<u8>,
        name: String,
    ) -> Result<(), String> {
        if let Some(mut group) = GroupStorage::get_group(account_id.to_owned(), group_id.to_owned())
        {
            // check if administrator
            if let Some(member) = group.get_member(&account_id.to_bytes()) {
                // check permission
                if member.role != 255 {
                    return Err("you don't have the permissions to rename this group".to_string());
                }
            } else {
                return Err("you are not a member for this group".to_string());
            }

            // rename group
            group.name = name;

            // update revision
            group.revision = group.revision + 1;

            // save group
            GroupStorage::save_group(account_id.to_owned(), group);

            return Ok(());
        }

        Err("can not find group".to_string())
    }

    /// get a new message ID
    pub fn get_new_message_id(account_id: &PeerId, group_id: &Vec<u8>) -> Vec<u8> {
        if let Some(mut group) = GroupStorage::get_group(account_id.to_owned(), group_id.to_owned())
        {
            // get my member
            if let Some(member) = group.members.get(&account_id.to_bytes()) {
                let new_index = member.last_message_index + 1;

                // update & save last_index in group
                let mut member_updated = member.to_owned();
                member_updated.last_message_index = new_index;
                group.members.insert(account_id.to_bytes(), member_updated);
                GroupStorage::save_group(account_id.to_owned(), group);

                // create message id
                return Chat::generate_message_id(group_id, account_id, new_index);
            }
        }

        Vec::new()
    }

    /// delete group from RPC command
    ///
    /// `account_id` the user account ID
    pub fn delete_group(account_id: &PeerId, group_id: &Vec<u8>) -> Result<(), String> {
        if let Some(group) = GroupStorage::get_group(account_id.to_owned(), group_id.to_owned()) {
            // check if administrator
            if let Some(member) = group.get_member(&account_id.to_bytes()) {
                // check permission - only admins can delete groups
                if member.role != 255 {
                    return Err("you don't have the permissions to delete this group".to_string());
                }
            } else {
                return Err("you are not a member of this group".to_string());
            }

            // delete group from storage
            GroupStorage::remove_group(account_id.to_owned(), group_id);

            return Ok(());
        }

        Err("group not found".to_string())
    }

    /// get group information from rpc command
    ///
    /// `account_id` the user account ID
    pub fn group_info(
        account_id: &PeerId,
        group_id: &Vec<u8>,
    ) -> Result<super::proto_rpc::GroupInfo, String> {
        let group;
        match GroupStorage::get_group(account_id.to_owned(), group_id.to_owned()) {
            Some(group_result) => group = group_result,
            None => return Err("group not found".to_string()),
        }

        let mut members: Vec<super::proto_rpc::GroupMember> = vec![];
        for m in group.members.values() {
            // Get user account information
            let user_peer_id = PeerId::from_bytes(&m.user_id).unwrap_or_else(|_| {
                log::error!("Invalid user_id bytes for group member");
                PeerId::random()
            });

            let user_account = UserAccounts::get_by_id(user_peer_id);

            let (name, reg_no, college, profile_pic, about) = if let Some(account) = user_account {
                (
                    account.name,
                    account.reg_no.unwrap_or_default(),
                    account.college.unwrap_or_default(),
                    account.profile_pic.unwrap_or_default(),
                    account.about.unwrap_or_default(),
                )
            } else {
                // Default values if user not found
                (
                    "Unknown User".to_string(),
                    String::new(),
                    String::new(),
                    String::new(),
                    String::new(),
                )
            };

            let member = super::proto_rpc::GroupMember {
                user_id: m.user_id.clone(),
                role: m.role,
                joined_at: m.joined_at,
                state: m.state,
                last_message_index: m.last_message_index,
                name,
                reg_no,
                profile_pic,
                about,
                college,
            };
            members.push(member);
        }

        let res = super::proto_rpc::GroupInfo {
            group_id: group.id,
            group_name: group.name,
            created_at: group.created_at,
            status: group.status,
            revision: group.revision,
            is_direct_chat: group.is_direct_chat,
            members,
            unread_messages: group.unread_messages,
            last_message_at: group.last_message_at,
            last_message: group.last_message_data,
            last_message_sender_id: group.last_message_sender_id,
        };
        Ok(res)
    }

    /// get group list from rpc command
    ///
    /// `account_id` the user account ID
    pub fn group_list(account_id: &PeerId) -> super::proto_rpc::GroupListResponse {
        let db_ref = GroupStorage::get_db_ref(account_id.to_owned());

        let mut res = super::proto_rpc::GroupListResponse { groups: vec![] };

        for entry in db_ref.groups.iter() {
            match entry {
                Ok((_, group_bytes)) => {
                    let group: Group = bincode::deserialize(&group_bytes).unwrap();
                    let mut members: Vec<super::proto_rpc::GroupMember> = vec![];
                    for m in group.members.values() {
                        let profile_pic = if m.profile_pic.is_empty() {
                                "data:image/png;base64,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".to_string()
                            } else {
                                m.profile_pic.clone()
                            };
                            
                        let member = super::proto_rpc::GroupMember {
                            user_id: m.user_id.clone(),
                            role: m.role,
                            joined_at: m.joined_at,
                            state: m.state,
                            last_message_index: m.last_message_index,
                            name: m.name.clone(),
                            reg_no: m.reg_no.clone(),
                            profile_pic,
                            about: m.about.clone(),
                            college: m.college.clone(),
                        };
                        members.push(member);
                    }

                    let grp = super::proto_rpc::GroupInfo {
                        group_id: group.id,
                        group_name: group.name,
                        created_at: group.created_at,
                        status: group.status,
                        revision: group.revision,
                        is_direct_chat: group.is_direct_chat,
                        members,
                        unread_messages: group.unread_messages,
                        last_message_at: group.last_message_at,
                        last_message: group.last_message_data,
                        last_message_sender_id: group.last_message_sender_id,
                    };
                    res.groups.push(grp);
                }
                _ => {}
            }
        }
        res
    }

    /// get invited list from rpc command
    pub fn invited_list(account_id: &PeerId) -> super::proto_rpc::GroupInvitedResponse {
        let db_ref = GroupStorage::get_db_ref(account_id.to_owned());

        let mut res = super::proto_rpc::GroupInvitedResponse { invited: vec![] };

        for entry in db_ref.invited.iter() {
            match entry {
                Ok((_, invite_bytes)) => {
                    let mut members: Vec<super::proto_rpc::GroupMember> = Vec::new();
                    let invite: GroupInvited = bincode::deserialize(&invite_bytes).unwrap();
                    for (_, member) in invite.group.members {
                        members.push(super::proto_rpc::GroupMember {
                            user_id: member.user_id,
                            role: member.role,
                            joined_at: member.joined_at,
                            state: member.state,
                            last_message_index: member.last_message_index,
                            name: member.name,
                            reg_no: member.reg_no,
                            profile_pic: member.profile_pic,
                            about: member.about,
                            college: member.college,
                        });
                    }

                    let invited = super::proto_rpc::GroupInvited {
                        sender_id: invite.sender_id.clone(),
                        received_at: invite.received_at,
                        group: Some(super::proto_rpc::GroupInfo {
                            group_id: invite.group.id,
                            group_name: invite.group.name,
                            created_at: invite.group.created_at,
                            status: invite.group.status,
                            revision: invite.group.revision,
                            is_direct_chat: invite.group.is_direct_chat,
                            members,
                            unread_messages: 0,
                            last_message_at: 0,
                            last_message: Vec::new(),
                            last_message_sender_id: Vec::new(),
                        }),
                    };

                    res.invited.push(invited);
                }
                _ => {}
            }
        }
        res
    }

    /// process group notify message from network
    pub fn on_group_notify(
        sender_id: PeerId,
        account_id: PeerId,
        notify: &super::proto_net::GroupInfo,
    ) {
        // check for valid group ID
        let group_id;
        match GroupId::from_bytes(&notify.group_id) {
            Ok(id) => group_id = id,
            Err(e) => {
                log::error!("invalid group id: {}", e);
                return;
            }
        }

        let mut first_join = false;
        let mut orign_members: BTreeMap<Vec<u8>, bool> = BTreeMap::new();
        let mut new_members: Vec<Vec<u8>> = vec![];

        // get group
        let mut group: Group;
        match GroupStorage::get_group(account_id, notify.group_id.clone()) {
            Some(my_group) => {
                group = my_group;

                // check if the sent revision is higher then the one we already have
                // return otherwise
                if group.revision >= notify.revision {
                    log::warn!("group update: got a smaller revision");
                    return;
                }

                // check if sender is administrator, otherwise return
                let mut sender_is_admin = false;
                for (member_id, member) in &group.members {
                    orign_members.insert(member_id.clone(), true);

                    if member.user_id == sender_id.to_bytes() && member.role == 255 {
                        sender_is_admin = true;
                    }
                }

                if !sender_is_admin {
                    log::error!(
                        "illegitimate update from user {} for group {}",
                        sender_id.to_base58(),
                        group_id.to_string(),
                    );
                    return;
                }
            }
            None => {
                first_join = true;

                group = Group::new();
            }
        }

        // check for new members
        let mut members: BTreeMap<Vec<u8>, super::GroupMember> = BTreeMap::new();
        for m in &notify.members {
            if orign_members.contains_key(&m.user_id) {
                orign_members.remove(&m.user_id);
            } else {
                new_members.push(m.user_id.clone());
            }

            members.insert(
                m.user_id.clone(),
                super::GroupMember {
                    user_id: m.user_id.clone(),
                    role: m.role,
                    joined_at: m.joined_at,
                    state: m.state,
                    last_message_index: m.last_message_index,
                    name: m.name.clone(),
                    reg_no: m.reg_no.clone(),
                    profile_pic: m.profile_pic.clone(),
                    about: m.about.clone(),
                    college: m.college.clone(),
                },
            );
        }

        // update group
        group.id = notify.group_id.clone();
        group.name = notify.group_name.clone();
        group.created_at = notify.created_at;
        group.revision = notify.revision;
        group.members = members;

        // activate group after invite accept
        if group.status == super::proto_rpc::GroupStatus::InviteAccepted as i32 {
            group.status = super::proto_rpc::GroupStatus::Active as i32;
        }

        // save group
        GroupStorage::save_group(account_id, group);

        // save events
        if first_join {
            let event = chat::rpc_proto::ChatContentMessage {
                message: Some(chat::rpc_proto::chat_content_message::Message::GroupEvent(
                    chat::rpc_proto::GroupEvent {
                        event_type: chat::rpc_proto::GroupEventType::Joined.try_into().unwrap(),
                        user_id: account_id.to_bytes(),
                    },
                )),
            };

            ChatStorage::save_message(
                &account_id,
                &group_id,
                &sender_id,
                &Vec::new(),
                Timestamp::get_timestamp(),
                event,
                chat::rpc_proto::MessageStatus::Received,
            );
        } else {
            for new_member in &new_members {
                let event = chat::rpc_proto::ChatContentMessage {
                    message: Some(chat::rpc_proto::chat_content_message::Message::GroupEvent(
                        chat::rpc_proto::GroupEvent {
                            event_type: chat::rpc_proto::GroupEventType::Joined.try_into().unwrap(),
                            user_id: new_member.clone(),
                        },
                    )),
                };

                ChatStorage::save_message(
                    &account_id,
                    &group_id,
                    &sender_id,
                    &Vec::new(),
                    Timestamp::get_timestamp(),
                    event,
                    chat::rpc_proto::MessageStatus::Received,
                );
            }

            for left_member in orign_members.keys() {
                let event = chat::rpc_proto::ChatContentMessage {
                    message: Some(chat::rpc_proto::chat_content_message::Message::GroupEvent(
                        chat::rpc_proto::GroupEvent {
                            event_type: chat::rpc_proto::GroupEventType::Left.try_into().unwrap(),
                            user_id: left_member.clone(),
                        },
                    )),
                };

                ChatStorage::save_message(
                    &account_id,
                    &group_id,
                    &sender_id,
                    &Vec::new(),
                    Timestamp::get_timestamp(),
                    event,
                    chat::rpc_proto::MessageStatus::Received,
                );
            }
        }
    }
}
