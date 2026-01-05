use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::OnceLock;
use tauri::{command, AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GDriveItem {
    pub name: String,
    pub data_id: Option<String>, // Made optional to handle null values
    pub is_folder: bool,
    pub size: Option<String>,
    pub file_type: Option<String>,
    pub url: Option<String>, // Made optional to handle null values
    pub parent_id: Option<String>,
    pub children: Option<Vec<GDriveItem>>,
}

/// Static cache for gdrive data
static GDRIVE_DATA_CACHE: OnceLock<Vec<GDriveItem>> = OnceLock::new();
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Initialize the app handle for resource resolution
pub fn init_app_handle(app: &AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
}

/// Load Google Drive data from JSON file (with caching)
fn load_gdrive_data() -> Result<Vec<GDriveItem>> {
    // Return cached data if already loaded
    if let Some(cached) = GDRIVE_DATA_CACHE.get() {
        return Ok(cached.clone());
    }

    let app = APP_HANDLE
        .get()
        .ok_or_else(|| anyhow::anyhow!("App handle not initialized"))?;

    // Resolve resource path from tauri backend
    let resource_path = app
        .path()
        .resolve("./assets/gdrive_data.json", tauri::path::BaseDirectory::Resource)
        .context("Failed to resolve gdrive_data.json")?;
    //println!("Resource path: {:?}", resource_path);
    let content = fs::read_to_string(&resource_path)
        .with_context(|| format!("Failed to read {:?}", resource_path))?;
    //println!("Content: {:?}", content);
    if content.trim().is_empty() {
        anyhow::bail!("gdrive_data.json is empty");
    }

    let data: Vec<GDriveItem> =
        serde_json::from_str(&content).context("Invalid JSON in gdrive_data.json")?;

    // Cache it
    let _ = GDRIVE_DATA_CACHE.set(data.clone());

    Ok(data)
}


/// Get root folders only (top level)
#[command]
pub fn get_root_folders() -> Result<Vec<GDriveItem>, String> {
    match load_gdrive_data() {
        Ok(data) => {
            let root_folders: Vec<GDriveItem> = data
                .into_iter()
                .filter(|item| item.is_folder && item.parent_id.is_none())
                .collect();

            Ok(root_folders)
        }
        Err(e) => {
            println!(
                "Warning: Failed to load gdrive data: {}. Returning empty list.",
                e
            );
            // Return empty list instead of error to make UI more graceful
            Ok(Vec::new())
        }
    }
}

pub mod download;
pub mod downloads;

use download::download_file as download_drive_file_impl;
use download::{get_recorded_downloads, is_file_downloaded, DownloadRecord};
use downloads::scan_downloads_with_metadata as scan_downloads_with_metadata_impl;

/// Test command to verify Tauri communication
#[command]
pub async fn test_downloads_command() -> Result<String, String> {
    Ok("Downloads command works!".to_string())
}

/// Scan Downloads folder for files
#[command]
pub async fn scan_downloads() -> Result<Vec<GDriveItem>, String> {
    downloads::scan_downloads_folder().await
}

/// Scan Downloads folder with metadata
#[command]
pub async fn scan_downloads_with_metadata() -> Result<Vec<GDriveItem>, String> {
    scan_downloads_with_metadata_impl().await
}

/// Download file from Google Drive
#[command]
pub async fn download_drive_file(
    file_id: String,
    file_name: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let file_path = download_drive_file_impl(file_id, file_name, app_handle)
        .await
        .map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Get recorded downloads with file metadata
#[command]
pub async fn get_recorded_downloads_command() -> Result<Vec<DownloadRecord>, String> {
    get_recorded_downloads().map_err(|e| e.to_string())
}

/// Check if a file has been downloaded
#[command]
pub fn check_file_downloaded(file_id: String) -> Result<bool, String> {
    Ok(is_file_downloaded(&file_id))
}

/// Open file with system default application
#[command]
pub fn open_storage_file(file_name: String) -> Result<bool, String> {
    let documents_dir =
        dirs::document_dir().ok_or_else(|| "Could not find Documents directory".to_string())?;

    let download_dir = documents_dir.join("KNOWLIA#NOTES");
    let file_path = download_dir.join(&file_name);

    if !file_path.exists() {
        return Err(format!("File not found: {:?}", file_path));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(true)
}
