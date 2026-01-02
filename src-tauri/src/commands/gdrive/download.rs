use anyhow::{Context, Result};
use directories::ProjectDirs;
use reqwest::header::{HeaderMap, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub file_id: String,
    pub file_name: String,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percentage: f64,
    pub site: String,   // "google drive", "dropbox", "onedrive", "etc."
    pub status: String, // "downloading", "completed", "error"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub file_id: String,
    pub file_name: String,
    pub download_time: String, // ISO 8601 timestamp
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadsData {
    pub downloads: Vec<DownloadRecord>,
}

/// Get the download directory (Documents/KNOWLIA#NOTES)
fn get_download_dir() -> Result<PathBuf> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find Documents directory"))?;

    let download_dir = documents_dir.join("KNOWLIA#NOTES");
    fs::create_dir_all(&download_dir)
        .with_context(|| format!("Failed to create download directory: {:?}", download_dir))?;

    Ok(download_dir)
}

/// Build HTTP client with proper headers (async)
async fn build_http_client() -> Result<reqwest::Client> {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
         (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            .parse()?,
    );
    headers.insert(ACCEPT, "*/*".parse()?);
    headers.insert(ACCEPT_LANGUAGE, "en-US,en;q=0.9".parse()?);

    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(Into::into)
}

/// Download file from Google Drive with progress tracking (async)
pub async fn download_file(
    file_id: String,
    file_name: String,
    app_handle: AppHandle,
) -> Result<PathBuf> {
    let download_dir = get_download_dir()?;
    let file_path = download_dir.join(&file_name);

    // Emit start event
    let _ = app_handle.emit(
        "download-progress",
        DownloadProgress {
            file_id: file_id.clone(),
            file_name: file_name.clone(),
            downloaded: 0,
            total: None,
            percentage: 0.0,
            status: "downloading".to_string(),
            site: "google drive".to_string(),
        },
    );

    let client = build_http_client().await?;
    let url = format!("https://drive.google.com/uc?export=download&id={}", file_id);

    let mut response = client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("Failed to download file: {}", file_name))?;

    if !response.status().is_success() {
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgress {
                file_id: file_id.clone(),
                file_name: file_name.clone(),
                downloaded: 0,
                total: None,
                percentage: 0.0,
                status: format!("error: HTTP {}", response.status()),
                site: "google drive".to_string(),
            },
        );
        return Err(anyhow::anyhow!(
            "HTTP {} – {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }

    // Get content length if available
    let total_size = response.content_length();

    // Create file
    let mut file = fs::File::create(&file_path)
        .with_context(|| format!("Failed to create file: {:?}", file_path))?;

    let mut downloaded: u64 = 0;

    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        // Calculate percentage
        let percentage = if let Some(total) = total_size {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        // Emit progress event every 64KB or on completion
        if downloaded % 65536 == 0 || chunk.len() < 8192 {
            let _ = app_handle.emit(
                "download-progress",
                DownloadProgress {
                    file_id: file_id.clone(),
                    file_name: file_name.clone(),
                    downloaded,
                    total: total_size,
                    percentage,
                    status: "downloading".to_string(),
                    site: "google drive".to_string(),
                },
            );
        }
    }

    // Emit completion event
    let _ = app_handle.emit(
        "download-progress",
        DownloadProgress {
            file_id: file_id.clone(),
            file_name: file_name.clone(),
            downloaded,
            total: total_size,
            percentage: 100.0,
            status: "completed".to_string(),
            site: "Google Drive".to_string(),
        },
    );

    // Record the download in our tracking system
    if let Err(e) = record_download(&file_id, &file_name, &file_path) {
        eprintln!("Failed to record download: {}", e);
    }

    Ok(file_path)
}

/// Get downloads data file path
fn get_downloads_data_path() -> Result<PathBuf> {
    let app_data_dir = ProjectDirs::from("com", "knowlia", "tabletop")
        .context("Failed to get project directories")?
        .data_dir()
        .to_path_buf();
    Ok(app_data_dir.join("qaul-desktop").join("downloads.json"))
}

/// Load downloads data from JSON file
fn load_downloads_data() -> Result<DownloadsData> {
    let downloads_path = get_downloads_data_path()?;

    if !downloads_path.exists() {
        // Create empty downloads data if file doesn't exist
        let empty_data = DownloadsData {
            downloads: Vec::new(),
        };
        save_downloads_data(&empty_data)?;
        return Ok(empty_data);
    }

    let content = fs::read_to_string(&downloads_path)
        .with_context(|| format!("Failed to read downloads data from {:?}", downloads_path))?;

    serde_json::from_str(&content).with_context(|| "Failed to parse downloads data")
}

/// Save downloads data to JSON file
fn save_downloads_data(data: &DownloadsData) -> Result<()> {
    let downloads_path = get_downloads_data_path()?;

    // Ensure parent directory exists
    if let Some(parent) = downloads_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create parent directory: {:?}", parent))?;
    }

    let content =
        serde_json::to_string_pretty(data).with_context(|| "Failed to serialize downloads data")?;

    fs::write(&downloads_path, content)
        .with_context(|| format!("Failed to write downloads data to {:?}", downloads_path))
}

/// Get downloads data mutex (initialize if needed)
static CACHE: std::sync::OnceLock<std::sync::Mutex<DownloadsData>> = std::sync::OnceLock::new();

fn get_downloads_cache() -> Result<&'static std::sync::Mutex<DownloadsData>> {
    Ok(CACHE.get_or_init(|| {
        let data = load_downloads_data().unwrap_or_else(|_| DownloadsData {
            downloads: Vec::new(),
        });
        std::sync::Mutex::new(data)
    }))
}

/// Record a download in the tracking system
fn record_download(file_id: &str, file_name: &str, file_path: &PathBuf) -> Result<()> {
    let cache = get_downloads_cache()?;
    let mut data = cache
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock downloads cache"))?;

    // Check if this file is already recorded
    if data.downloads.iter().any(|d| d.file_id == file_id) {
        return Ok(()); // Already recorded
    }

    let record = DownloadRecord {
        file_id: file_id.to_string(),
        file_name: file_name.to_string(),
        download_time: chrono::Utc::now().to_rfc3339(),
        file_path: file_path.to_string_lossy().to_string(),
    };

    data.downloads.push(record);

    // Save to file
    save_downloads_data(&*data)?;

    println!("Recorded download: {} ({})", file_name, file_id);
    Ok(())
}

/// Get all recorded downloads
pub fn get_recorded_downloads() -> Result<Vec<DownloadRecord>> {
    let cache = get_downloads_cache()?;
    let data = cache
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock downloads cache"))?;
    Ok(data.downloads.clone())
}

/// Check if a file has been downloaded
pub fn is_file_downloaded(file_id: &str) -> bool {
    if let Ok(cache) = get_downloads_cache() {
        if let Ok(data) = cache.lock() {
            return data.downloads.iter().any(|d| d.file_id == file_id);
        }
    }
    false
}
