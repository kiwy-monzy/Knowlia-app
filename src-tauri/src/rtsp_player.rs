use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone)]
pub enum PlayerState {
    Stopped,
    Connecting,
    Playing,
    Error(String),
}

#[derive(Debug, Clone)]
pub struct Frame {
    pub data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

pub struct RtspPlayer {
    state: Arc<Mutex<PlayerState>>,
    current_frame: Arc<Mutex<Option<Frame>>>,
    rtsp_url: Arc<Mutex<String>>,
}

impl RtspPlayer {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(PlayerState::Stopped)),
            current_frame: Arc::new(Mutex::new(None)),
            rtsp_url: Arc::new(Mutex::new(String::new())),
        }
    }

    pub fn set_url(&self, url: String) {
        *self.rtsp_url.lock().unwrap() = url;
    }

    pub fn get_state(&self) -> PlayerState {
        self.state.lock().unwrap().clone()
    }

    pub fn get_current_frame(&self) -> Option<Frame> {
        self.current_frame.lock().unwrap().clone()
    }

    pub fn play(&self) -> Result<(), String> {
        let url = self.rtsp_url.lock().unwrap().clone();
        if url.is_empty() {
            return Err("No RTSP URL set".to_string());
        }

        {
            *self.state.lock().unwrap() = PlayerState::Connecting;
        }

        let state = self.state.clone();
        let current_frame = self.current_frame.clone();
        
        thread::spawn(move || {
            // Simulate RTSP connection and streaming
            thread::sleep(Duration::from_secs(1));
            
            // Check if URL looks like an RTSP URL
            if !url.starts_with("rtsp://") && !url.starts_with("rtsps://") {
                *state.lock().unwrap() = PlayerState::Error("Invalid RTSP URL format".to_string());
                return;
            }

            // Extract path from URL
            let path = if let Some(start) = url.find("://") {
                let after_protocol = &url[start + 3..];
                if let Some(slash_pos) = after_protocol.find('/') {
                    &after_protocol[slash_pos..]
                } else {
                    "/"
                }
            } else {
                "/"
            };

            // Simulate connection attempt to MediaMTX server
            if url.contains("127.0.0.1:8554") {
                // Check if this is a common path that might have a source
                let has_source = match path {
                    "/demo" => true, // Demo stream for testing
                    "/stream" | "/stream2" | "/webcam" => false, // No source by default
                    _ => false,
                };

                if has_source {
                    *state.lock().unwrap() = PlayerState::Playing;

                    // Simulate video frames with lower frequency to reduce performance impact
                    for i in 0..300 {
                        if matches!(*state.lock().unwrap(), PlayerState::Stopped) {
                            break;
                        }

                        // Only generate frame data periodically to reduce overhead
                        if i % 3 == 0 {
                            // Create a smaller dummy frame to reduce memory usage
                            let mut frame_data = vec![0u8; 320 * 240 * 3]; // Smaller RGB data
                            
                            // Create a simple pattern that changes over time
                            for y in 0..240 {
                                for x in 0..320 {
                                    let idx = (y * 320 + x) * 3;
                                    let color_value = ((i + x + y) % 256) as u8;
                                    frame_data[idx] = color_value;     // R
                                    frame_data[idx + 1] = (255 - color_value) as u8; // G  
                                    frame_data[idx + 2] = (color_value / 2) as u8;  // B
                                }
                            }

                            let frame = Frame {
                                data: frame_data,
                                width: 320,
                                height: 240,
                            };

                            *current_frame.lock().unwrap() = Some(frame);
                        }
                        
                        // Slower frame rate to reduce performance impact
                        thread::sleep(Duration::from_millis(100)); // ~10 FPS instead of 30 FPS
                    }
                } else {
                    // Simulate waiting for a source to be published
                    for _i in 0..5 {
                        if matches!(*state.lock().unwrap(), PlayerState::Stopped) {
                            break;
                        }
                        thread::sleep(Duration::from_millis(1000));
                    }
                    
                    *state.lock().unwrap() = PlayerState::Error(
                        format!("No stream published to path '{}'. Use FFmpeg or OBS to publish a stream first.", path)
                    );
                    return;
                }
            } else {
                // Simulate connection to external RTSP server
                thread::sleep(Duration::from_secs(1));
                *state.lock().unwrap() = PlayerState::Error(
                    format!("Cannot connect to external server: {}", url)
                );
                return;
            }

            *state.lock().unwrap() = PlayerState::Stopped;
        });

        Ok(())
    }

    pub fn stop(&self) {
        *self.state.lock().unwrap() = PlayerState::Stopped;
    }
}

impl Default for RtspPlayer {
    fn default() -> Self {
        Self::new()
    }
}
