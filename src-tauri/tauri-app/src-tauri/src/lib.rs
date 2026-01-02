
mod qaul;
pub mod modes;
mod rtc;
mod rtc_str0m;
mod group;
mod user;
use libp2p::PeerId;
use crate::group::{create_group, create_direct_chat, get_or_create_direct_chat, get_group_info, get_group_list, rename_group, get_pending_invitations, get_new_message_id, invite_user_to_group, reply_to_group_invitation, remove_user_from_group, leave_group, get_messages, send_message, read_file_as_base64, delete_all_group_messages, delete_messages};
/// Get the current user as a libp2p PeerId
pub fn get_current_user_internal() -> Option<PeerId> {
    libqaul::node::user_accounts::UserAccounts::get_default_user()
        .map(|user| user.id)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(qaul::init())
        .plugin(user::register_commands())
        .plugin(group::register_commands())
        .invoke_handler(tauri::generate_handler![
            // Group commands
            create_group,
            create_direct_chat,
            get_or_create_direct_chat,
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
            delete_all_group_messages,
            delete_messages,
            // RTC commands
            rtc::rtc_init,
            rtc::rtc_session_request,
            rtc::rtc_session_management,
            rtc::rtc_session_list,
            rtc::rtc_send_message,
            rtc::rtc_get_session,
            rtc::rtc_remove_session,
            rtc::start_str0m_server,
            // RTC str0m integration commands
            rtc_str0m::rtc_str0m_init,
            rtc_str0m::rtc_str0m_create_session,
            rtc_str0m::rtc_str0m_accept_session,
            rtc_str0m::rtc_str0m_get_state,
            rtc_str0m::handle_webrtc_connection,
            rtc_str0m::start_str0m_media_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
