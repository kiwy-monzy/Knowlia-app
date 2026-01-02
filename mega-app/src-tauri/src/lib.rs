use anyhow::Result;
use mega_session::MegaManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

mod mega_session;

// Struct to hold our application state
struct AppState {
    mega_manager: Arc<MegaManager>,
}

// Command to login to MEGA
#[tauri::command]
async fn mega_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
    mfa: Option<String>,
) -> Result<(), String> {
    state
        .mega_manager
        .login(&email, &password, mfa.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// Command to list files from MEGA
#[tauri::command]
async fn mega_list_files(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<serde_json::Value, String> {
    state
        .mega_manager
        .list_files(path.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the Mega manager
    let mega_manager = match MegaManager::new() {
        Ok(manager) => manager,
        Err(e) => {
            eprintln!("Failed to initialize Mega manager: {}", e);
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .manage(AppState {
            mega_manager: Arc::new(mega_manager),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![mega_login, mega_list_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
