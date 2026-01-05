use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use serde::{Deserialize, Serialize};
use libqaul::connections::ble;

// BLE device information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BleDeviceInfo {
    pub ble_support: bool,
    pub id: String,
    pub name: String,
    pub bluetooth_on: bool,
    pub adv_extended: bool,
    pub adv_extended_bytes: u32,
    pub le_2m: bool,
    pub le_coded: bool,
    pub le_audio: bool,
    pub le_periodic_adv_support: bool,
    pub le_multiple_adv_support: bool,
    pub offload_filter_support: bool,
    pub offload_scan_batching_support: bool,
}

// Discovered device structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub qaul_id: String,
    pub rssi: i32,
    pub discovered_at: u64,
}

// BLE status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BleStatus {
    pub is_enabled: bool,
    pub is_scanning: bool,
    pub is_advertising: bool,
    pub discovered_count: usize,
    pub connected_count: usize,
    pub last_error: Option<String>,
}

// Global state for simplicity
static mut BLE_ENABLED: bool = false;
static mut DISCOVERED_DEVICES: Vec<DiscoveredDevice> = Vec::new();

/// Get BLE device information
#[tauri::command]
pub async fn get_ble_info() -> Result<BleDeviceInfo, String> {
    // Return default device info for now
    let device_info = BleDeviceInfo {
        ble_support: true,
        id: "Unknown".to_string(),
        name: "BLE Device".to_string(),
        bluetooth_on: true,
        adv_extended: false,
        adv_extended_bytes: 0,
        le_2m: false,
        le_coded: false,
        le_audio: false,
        le_periodic_adv_support: false,
        le_multiple_adv_support: false,
        offload_filter_support: false,
        offload_scan_batching_support: false,
    };

    Ok(device_info)
}

/// Get current BLE status
#[tauri::command]
pub async fn get_ble_status() -> Result<BleStatus, String> {
    let is_enabled = unsafe { BLE_ENABLED };
    let discovered_count = unsafe { DISCOVERED_DEVICES.len() };
    
    Ok(BleStatus {
        is_enabled,
        is_scanning: is_enabled,
        is_advertising: is_enabled,
        discovered_count,
        connected_count: discovered_count,
        last_error: None,
    })
}

/// Start BLE module
#[tauri::command]
pub async fn start_ble() -> Result<String, String> {
    // Update state
    unsafe {
        BLE_ENABLED = true;
    }

    // Send start request to BLE module
    ble::Ble::module_start();

    Ok("BLE module start request sent".to_string())
}

/// Stop BLE module
#[tauri::command]
pub async fn stop_ble() -> Result<String, String> {
    // Update state
    unsafe {
        BLE_ENABLED = false;
        DISCOVERED_DEVICES.clear();
    }

    // Send stop request to BLE module
    ble::Ble::module_stop();

    Ok("BLE module stop request sent".to_string())
}

/// Get discovered BLE devices
#[tauri::command]
pub async fn get_discovered_devices() -> Result<Vec<DiscoveredDevice>, String> {
    // Return current discovered devices
    let devices = unsafe { DISCOVERED_DEVICES.clone() };
    Ok(devices)
}

/// Request BLE permissions (for platforms that require it)
#[tauri::command]
pub async fn request_ble_permissions() -> Result<bool, String> {
    // For now, just return true - actual permission handling would be platform-specific
    Ok(true)
}

/// Send direct message to BLE device
#[tauri::command]
pub async fn send_ble_message(
    device_id: String,
    message_data: Vec<u8>,
) -> Result<String, String> {
    // Convert device_id to bytes (assuming it's hex string)
    let receiver_id = hex::decode(device_id)
        .map_err(|e| format!("Invalid device ID: {}", e))?;
    
    // Get sender ID
    let sender_id = libqaul::node::Node::get_small_id();

    // Send message via BLE module
    ble::Ble::message_send(receiver_id, sender_id, message_data);

    Ok("BLE message sent".to_string())
}

/// Add discovered device (called when device is discovered)
pub fn add_discovered_device(device: ble::proto::BleDeviceDiscovered) {
    let discovered_device = DiscoveredDevice {
        qaul_id: hex::encode(&device.qaul_id),
        rssi: device.rssi,
        discovered_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    unsafe {
        // Check if device already exists
        if !DISCOVERED_DEVICES.iter().any(|d| d.qaul_id == discovered_device.qaul_id) {
            DISCOVERED_DEVICES.push(discovered_device);
        }
    }
}

/// Remove discovered device (called when device becomes unavailable)
pub fn remove_discovered_device(device: ble::proto::BleDeviceUnavailable) {
    let device_id = hex::encode(&device.qaul_id);
    
    unsafe {
        DISCOVERED_DEVICES.retain(|d| d.qaul_id != device_id);
    }
}

/// Register BLE commands with Tauri
pub fn register_commands<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ble")
        .invoke_handler(tauri::generate_handler![
            get_ble_info,
            get_ble_status,
            start_ble,
            stop_ble,
            get_discovered_devices,
            request_ble_permissions,
            send_ble_message,
        ])
        .build()
}