use libp2p::PeerId;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

// Helper function to decode peer_id array to readable string
fn decode_peer_id(peer_id_array: &[u8]) -> String {
    match PeerId::from_bytes(&peer_id_array) {
        Ok(peer_id) => peer_id.to_string(),
        Err(_) => format!("Invalid PeerId: {:?}", peer_id_array),
    }
}

// Helper function to decode and modify JSON values containing peer_id/node_id arrays
fn decode_peer_ids_in_value(value: &mut Value) {
    match value {
        Value::Object(ref mut map) => {
            // Decode peer_id if present
            if let Some(peer_id_array) = map.get("peer_id").and_then(|v| v.as_array()) {
                let peer_id_bytes: Vec<u8> = peer_id_array
                    .iter()
                    .filter_map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                if !peer_id_bytes.is_empty() {
                    map.insert(
                        "peer_id_decoded".to_string(),
                        Value::String(decode_peer_id(&peer_id_bytes)),
                    );
                }
            }

            // Decode node_id if present
            if let Some(node_id_array) = map.get("node_id").and_then(|v| v.as_array()) {
                let node_id_bytes: Vec<u8> = node_id_array
                    .iter()
                    .filter_map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                if !node_id_bytes.is_empty() {
                    map.insert(
                        "node_id_decoded".to_string(),
                        Value::String(decode_peer_id(&node_id_bytes)),
                    );
                }
            }

            // Decode target_peer_id if present
            if let Some(target_peer_id_array) = map.get("target_peer_id").and_then(|v| v.as_array())
            {
                let target_peer_id_bytes: Vec<u8> = target_peer_id_array
                    .iter()
                    .filter_map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                if !target_peer_id_bytes.is_empty() {
                    map.insert(
                        "target_peer_id_decoded".to_string(),
                        Value::String(decode_peer_id(&target_peer_id_bytes)),
                    );
                }
            }

            // Decode via_peer_id if present
            if let Some(via_peer_id_array) = map.get("via_peer_id").and_then(|v| v.as_array()) {
                let via_peer_id_bytes: Vec<u8> = via_peer_id_array
                    .iter()
                    .filter_map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
                    .collect();
                if !via_peer_id_bytes.is_empty() {
                    map.insert(
                        "via_peer_id_decoded".to_string(),
                        Value::String(decode_peer_id(&via_peer_id_bytes)),
                    );
                }
            }

            // Recursively process nested objects
            for (_, v) in map.iter_mut() {
                decode_peer_ids_in_value(v);
            }
        }
        Value::Array(arr) => {
            // Recursively process array elements
            for v in arr.iter_mut() {
                decode_peer_ids_in_value(v);
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub async fn download_qaul_file(file_id: String, file_name: String) -> Result<String, String> {
    // Get downloads directory
    let downloads_dir =
        dirs::download_dir().ok_or_else(|| "Could not find downloads directory".to_string())?;

    let qaul_downloads_dir = downloads_dir.join("qaul-downloads");

    // Create downloads directory if it doesn't exist
    fs::create_dir_all(&qaul_downloads_dir)
        .map_err(|e| format!("Failed to create downloads directory: {}", e))?;

    let file_path = qaul_downloads_dir.join(file_name);

    // Request file from libqaul
    match qaul_cli::download_file(file_id.clone(), file_path.to_string_lossy().to_string()) {
        Ok(_) => {
            log::info!(
                "Successfully downloaded file: {} to {:?}",
                file_id,
                file_path
            );
            Ok(file_path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::error!("Failed to download file {}: {}", file_id, e);
            Err(format!("Failed to download file: {}", e))
        }
    }
}

#[tauri::command]
pub async fn open_qaul_file(file_path: String) -> Result<(), String> {
    // Check if file exists
    if !PathBuf::from(&file_path).exists() {
        return Err("File does not exist".to_string());
    }

    // Open file with system default application
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/c", "start", "", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn check_qaul_file_downloaded(file_name: String) -> Result<bool, String> {
    let downloads_dir =
        dirs::download_dir().ok_or_else(|| "Could not find downloads directory".to_string())?;

    let qaul_downloads_dir = downloads_dir.join("qaul-downloads");
    let file_path = qaul_downloads_dir.join(file_name);

    Ok(file_path.exists())
}

#[tauri::command]
pub async fn get_qaul_file_path(_file_id: String, file_name: String) -> Result<String, String> {
    let downloads_dir =
        dirs::download_dir().ok_or_else(|| "Could not find downloads directory".to_string())?;

    let qaul_downloads_dir = downloads_dir.join("qaul-downloads");
    let file_path = qaul_downloads_dir.join(file_name);

    if file_path.exists() {
        Ok(file_path.to_string_lossy().to_string())
    } else {
        Err("File not downloaded".to_string())
    }
}

#[tauri::command]
pub async fn start_file_download(
    file_id: u64,
    file_name: String,
    file_size: u64,
) -> Result<String, String> {
    log::info!(
        "Starting file download: file_id={}, file_name={}, file_size={}",
        file_id,
        file_name,
        file_size
    );

    // Get the Downloads directory
    let downloads_dir = dirs::download_dir()
        .ok_or_else(|| "Could not find downloads directory".to_string())?;

    // Create KnowliaDownloads folder
    let knowlia_downloads = downloads_dir.join("KnowliaDownloads");
    fs::create_dir_all(&knowlia_downloads)
        .map_err(|e| format!("Failed to create KnowliaDownloads directory: {}", e))?;

    let destination_path = knowlia_downloads.join(&file_name);

    // Check if file already exists in KnowliaDownloads
    if destination_path.exists() {
        log::info!("File already exists in KnowliaDownloads: {:?}", destination_path);
        return Ok(destination_path.to_string_lossy().to_string());
    }

    // Get the source file path from libqaul storage
    match qaul_cli::get_file_path(file_id) {
        Ok(source_path) => {
            log::info!("Found file in libqaul storage: {}", source_path);
            
            // Copy file from libqaul storage to KnowliaDownloads
            fs::copy(&source_path, &destination_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            
            log::info!("File copied to: {:?}", destination_path);
            Ok(destination_path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::warn!("File not yet received in libqaul storage: {}", e);
            Err(format!("File not yet available: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_download_progress(file_id: u64) -> Result<String, String> {
    // Get file download progress from qaul_cli
    match qaul_cli::get_download_progress(file_id) {
        Ok(progress_json) => Ok(progress_json),
        Err(e) => {
            log::debug!("Failed to get download progress for file {}: {}", file_id, e);
            // Return a default progress JSON if the file is not found
            Ok(serde_json::json!({
                "file_id": file_id,
                "progress_percent": 0,
                "file_state": "unknown"
            })
            .to_string())
        }
    }
}

#[tauri::command]
pub async fn get_file_path(file_id: u64) -> Result<String, String> {
    // Get file path from qaul_cli
    qaul_cli::get_file_path(file_id)
}

#[tauri::command]
pub async fn check_file_in_downloads(file_name: String) -> Result<Option<String>, String> {
    // Get the Downloads directory
    let downloads_dir = dirs::download_dir()
        .ok_or_else(|| "Could not find downloads directory".to_string())?;

    let knowlia_downloads = downloads_dir.join("KnowliaDownloads");
    let file_path = knowlia_downloads.join(&file_name);

    if file_path.exists() {
        Ok(Some(file_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}


#[tauri::command]
pub async fn get_all_discovered_users() -> Result<Value, String> {
    // Get comprehensive user discovery information
    let users = qaul_cli::get_all_discovered_users()
        .map_err(|e| format!("Failed to get discovered users: {}", e))?;

    Ok(users)
}

#[tauri::command]
pub async fn get_network_info() -> Result<Value, String> {
    // Get real-time internet neighbour information
    let internet_neighbours = qaul_cli::get_internet_neighbours()
        .map_err(|e| format!("Failed to get internet neighbours: {}", e))?;

    // Get full network topology for the network page
    let topo = qaul_cli::get_network_topology()
        .map_err(|e| format!("Failed to get network topology: {}", e))?;

    // Pick the first online internet neighbour as gateway, or fallback to first configured
    let mut gateway_name: Option<String> = None;
    let mut gateway_addr: Option<String> = None;
    let mut gateway_online = false;
    let mut gateway_latency_ms: Option<u32> = None;

    if !internet_neighbours.is_empty() {
        // Use the first online neighbour with RTT data
        for neighbour in &internet_neighbours {
            if neighbour.online {
                gateway_name = Some(neighbour.name.clone());
                gateway_addr = Some(neighbour.address.clone());
                gateway_online = neighbour.online;
                gateway_latency_ms = neighbour.rtt_ms;
                break;
            }
        }

        // If no online neighbours, use the first configured one
        if gateway_name.is_none() {
            let first = &internet_neighbours[0];
            gateway_name = Some(first.name.clone());
            gateway_addr = Some(first.address.clone());
            gateway_online = first.online;
            gateway_latency_ms = first.rtt_ms;
        }
    } else {
        // Fallback to static configuration if no live neighbours
        if let Some(peers) = topo.get("internet_peers").and_then(|v| v.as_array()) {
            for p in peers {
                let enabled = p.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                if enabled {
                    gateway_name = p
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    gateway_addr = p
                        .get("address")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    gateway_online = false; // Not actually connected
                    break;
                }
            }
        }
    }

    let gateway_name = gateway_name.unwrap_or_else(|| "No internet peer".to_string());

    // Create the response JSON
    let mut response = serde_json::json!({
        // Placeholder throughput / latency for now
        "tx": 0,
        "rx": 0,
        "tx_bytes": 0,
        "rx_bytes": 0,
        "latency_ms": gateway_latency_ms,
        "is_online": gateway_online,
        "gateway_name": gateway_name,
        "gateway_addr": gateway_addr,
        "gateway_latency_ms": gateway_latency_ms,
        "gateway_online": gateway_online,
        // Also return full topology and live neighbours for the network page
        "topology": topo,
        "internet_neighbours": internet_neighbours,
    });

    // Decode all peer_id and node_id arrays in the response
    decode_peer_ids_in_value(&mut response);

    Ok(response)
}

pub async fn start_network_info_emitter(app: AppHandle) -> Result<(), String> {
    // Start a background task that emits network info events
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(500)); // Emit every 500ms for fast updates

        loop {
            interval.tick().await;

            match get_network_info().await {
                Ok(info) => {
                    if let Err(e) = app.emit("network-info-update", &info) {
                        eprintln!("Failed to emit network-info-update event: {}", e);
                        // If emit fails, the app might be closing, so break the loop
                        break;
                    }
                }
                Err(e) => {
                    // Emit error event
                    let _ = app.emit("network-info-error", &e);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn send_channel_message(group_name: String, message: String) -> Result<Value, String> {
    // Use HTTP POST to send channel message to network node API
    let client = reqwest::Client::new();

    // Create JSON payload for broadcast message
    let payload = serde_json::json!({
        "text": message,
        "group_name": group_name
    });

    // Send HTTP POST request to network node API
    let api_url = "http://127.0.0.1:3030/broadcast";
    let response = client
        .post(api_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send HTTP request: {}", e))?;

    if response.status().is_success() {
        response
            .json::<Value>()
            .await
            .map_err(|e| format!("Failed to parse JSON response: {}", e))
    } else {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("HTTP error {}: {}", status, error_text))
    }
}

#[tauri::command]
pub async fn request_group_list() -> Result<(), String> {
    // use crate::qaul::group::Group;
    //Group::group_list();
    Ok(())
}

#[tauri::command]
pub async fn request_group_messages(group_id: String) -> Result<(), String> {
    //use crate::qaul::chat::Chat;

    log::debug!(
        "[request_group_messages] Requesting messages for group_id: {}",
        group_id
    );

    // Convert UUID string to binary
    let group_id_bin = uuid::Uuid::parse_str(&group_id)
        .map_err(|e| {
            log::error!(
                "[request_group_messages] Invalid group ID format: {} - {}",
                group_id,
                e
            );
            format!("Invalid group ID format: {}", e)
        })?
        .as_bytes()
        .to_vec();

    log::debug!(
        "[request_group_messages] Converted group_id to binary, length: {}",
        group_id_bin.len()
    );

    // Request messages with last_index = 0 to get all messages
    //Chat::request_chat_conversation(group_id_bin, 0);

    log::debug!("[request_group_messages] Sent conversation request");

    return Ok(());
}
