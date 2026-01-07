use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use serde::{Deserialize, Serialize};
use libqaul::connections::ble;
use std::sync::{Mutex, OnceLock};

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

// Thread-safe global state
static BLE_STATE: OnceLock<Mutex<BleState>> = OnceLock::new();

#[derive(Debug, Default)]
struct BleState {
    enabled: bool,
    discovered_devices: Vec<DiscoveredDevice>,
}

impl BleState {
    fn get() -> &'static Mutex<BleState> {
        BLE_STATE.get_or_init(|| Mutex::new(BleState::default()))
    }
}

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
    let state = BleState::get().lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;
    let discovered_count = state.discovered_devices.len();
    let is_enabled = state.enabled;
    
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
    {
        let mut state = BleState::get().lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;
        state.enabled = true;
    }

    // Send start request to BLE module
    ble::Ble::module_start();

    Ok("BLE module start request sent".to_string())
}

/// Stop BLE module
#[tauri::command]
pub async fn stop_ble() -> Result<String, String> {
    // Update state
    {
        let mut state = BleState::get().lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;
        state.enabled = false;
        state.discovered_devices.clear();
    }

    // Send stop request to BLE module
    ble::Ble::module_stop();

    Ok("BLE module stop request sent".to_string())
}

/// Get discovered BLE devices
#[tauri::command]
pub async fn get_discovered_devices() -> Result<Vec<DiscoveredDevice>, String> {
    // Return current discovered devices
    let state = BleState::get().lock().map_err(|e| format!("Failed to acquire lock: {}", e))?;
    let devices = state.discovered_devices.clone();
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

    if let Ok(mut state) = BleState::get().lock() {
        // Check if device already exists
        if !state.discovered_devices.iter().any(|d| d.qaul_id == discovered_device.qaul_id) {
            state.discovered_devices.push(discovered_device);
        }
    }
}

/// Remove discovered device (called when device becomes unavailable)
pub fn remove_discovered_device(device: ble::proto::BleDeviceUnavailable) {
    let device_id = hex::encode(&device.qaul_id);
    
    if let Ok(mut state) = BleState::get().lock() {
        state.discovered_devices.retain(|d| d.qaul_id != device_id);
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