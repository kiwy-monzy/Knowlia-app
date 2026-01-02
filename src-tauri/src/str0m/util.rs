pub fn select_host_address() -> String {
    // Use 127.0.0.1 for WebRTC compatibility
    // 0.0.0.0 is not a valid ICE candidate address
    "127.0.0.1".to_string()
}
