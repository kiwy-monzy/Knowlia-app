use screenshots::Screen;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowProcessInfo {
    pub title: String,
    pub process_name: String,
    pub pid: u32,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;
    use std::ffi::OsString;
    use std::mem;
    use std::os::windows::ffi::OsStringExt;
    use std::ptr;
    use winapi::shared::minwindef::{DWORD, FALSE};
    use winapi::shared::windef::RECT;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetModuleBaseNameW;
    use winapi::um::winuser::{
        GetForegroundWindow, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId,
    };

    pub fn get_active_window_info() -> Result<WindowProcessInfo, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return Err("No active window found".to_string());
            }

            let mut rect: RECT = mem::zeroed();
            if GetWindowRect(hwnd, &mut rect) == 0 {
                return Err("Failed to get window rect".to_string());
            }

            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            let title = if title_len > 0 {
                OsString::from_wide(&title_buf[..title_len as usize])
                    .to_string_lossy()
                    .to_string()
            } else {
                "Unknown".to_string()
            };

            let mut process_id: DWORD = 0;
            GetWindowThreadProcessId(hwnd, &mut process_id);

            let process_handle = OpenProcess(0x0400 | 0x0010, FALSE, process_id); // PROCESS_QUERY_INFORMATION | PROCESS_VM_READ
            let process_name = if !process_handle.is_null() {
                let mut name_buf = [0u16; 256];
                let name_len = GetModuleBaseNameW(
                    process_handle,
                    ptr::null_mut(),
                    name_buf.as_mut_ptr(),
                    name_buf.len() as DWORD,
                );
                if name_len > 0 {
                    OsString::from_wide(&name_buf[..name_len as usize])
                        .to_string_lossy()
                        .to_string()
                } else {
                    "Unknown".to_string()
                }
            } else {
                "Unknown".to_string()
            };

            Ok(WindowProcessInfo {
                title,
                process_name,
                pid: process_id,
                x: rect.left,
                y: rect.top,
                width: (rect.right - rect.left) as u32,
                height: (rect.bottom - rect.top) as u32,
            })
        }
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;

    use core_foundation::base::{CFRelease, CFTypeRef, TCFType};
    use core_foundation::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
    use core_foundation::number::{CFNumberGetValue, CFNumberRef};
    use core_foundation::string::{
        kCFStringEncodingUTF8, CFString, CFStringGetCString, CFStringRef,
    };
    use core_graphics::window::{
        kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
        CGWindowListCopyWindowInfo,
    };

    use std::ffi::CStr;

    extern "C" {
        static kCGWindowOwnerPID: CFStringRef;
        static kCGWindowOwnerName: CFStringRef;
        static kCGWindowName: CFStringRef;
        static kCGWindowBounds: CFStringRef;
        static kCGWindowLayer: CFStringRef;
    }

    const BOUNDS_KEY_X: &str = "X";
    const BOUNDS_KEY_Y: &str = "Y";
    const BOUNDS_KEY_WIDTH: &str = "Width";
    const BOUNDS_KEY_HEIGHT: &str = "Height";

    pub fn get_active_window_info() -> Result<WindowProcessInfo, String> {
        unsafe {
            let window_list = CGWindowListCopyWindowInfo(
                kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
                0,
            );

            if window_list.is_null() {
                return Err("Failed to get window list".to_string());
            }

            // Find the frontmost window (layer 0)
            let count = core_foundation::array::CFArrayGetCount(window_list);
            for i in 0..count {
                let window_info = core_foundation::array::CFArrayGetValueAtIndex(window_list, i);
                let window_dict = window_info as CFDictionaryRef;

                // Check if this is a foreground window (layer 0)
                let layer_ref = CFDictionaryGetValue(window_dict, kCGWindowLayer as *const _);
                if !layer_ref.is_null() {
                    let mut layer: i32 = 0;
                    if CFNumberGetValue(
                        layer_ref as CFNumberRef,
                        core_foundation::number::kCFNumberSInt32Type,
                        &mut layer as *mut i32 as *mut _,
                    ) && layer == 0
                    {
                        // Get window info
                        let title = get_cf_string_value(window_dict, kCGWindowName)
                            .unwrap_or_else(|| "Unknown".to_string());
                        let process_name = get_cf_string_value(window_dict, kCGWindowOwnerName)
                            .unwrap_or_else(|| "Unknown".to_string());

                        let pid_ref =
                            CFDictionaryGetValue(window_dict, kCGWindowOwnerPID as *const _);
                        let mut pid: u32 = 0;
                        if !pid_ref.is_null() {
                            CFNumberGetValue(
                                pid_ref as CFNumberRef,
                                core_foundation::number::kCFNumberSInt32Type,
                                &mut pid as *mut u32 as *mut _,
                            );
                        }

                        // Get bounds
                        let bounds_ref =
                            CFDictionaryGetValue(window_dict, kCGWindowBounds as *const _);
                        let (x, y, width, height) = if !bounds_ref.is_null() {
                            let bounds_dict = bounds_ref as CFDictionaryRef;

                            let x = get_cf_number_value(bounds_dict, BOUNDS_KEY_X).unwrap_or(0.0);
                            let y = get_cf_number_value(bounds_dict, BOUNDS_KEY_Y).unwrap_or(0.0);
                            let width =
                                get_cf_number_value(bounds_dict, BOUNDS_KEY_WIDTH).unwrap_or(0.0);
                            let height =
                                get_cf_number_value(bounds_dict, BOUNDS_KEY_HEIGHT).unwrap_or(0.0);

                            (
                                x.round() as i32,
                                y.round() as i32,
                                width.max(0.0).round() as u32,
                                height.max(0.0).round() as u32,
                            )
                        } else {
                            (0, 0, 0, 0)
                        };

                        CFRelease(window_list as CFTypeRef);
                        return Ok(WindowProcessInfo {
                            title,
                            process_name,
                            pid,
                            x,
                            y,
                            width,
                            height,
                        });
                    }
                }
            }

            CFRelease(window_list as CFTypeRef);
            Err("No active window found".to_string())
        }
    }

    unsafe fn get_cf_string_value(dict: CFDictionaryRef, key: CFStringRef) -> Option<String> {
        let value_ref = CFDictionaryGetValue(dict, key as *const _);
        if value_ref.is_null() {
            return None;
        }

        let mut buffer = [0i8; 256];
        if CFStringGetCString(
            value_ref as CFStringRef,
            buffer.as_mut_ptr(),
            buffer.len() as _,
            kCFStringEncodingUTF8,
        ) != 0
        {
            let c_str = CStr::from_ptr(buffer.as_ptr());
            c_str.to_string_lossy().to_string().into()
        } else {
            None
        }
    }

    unsafe fn get_cf_number_value(dict: CFDictionaryRef, key: &str) -> Option<f64> {
        let cf_key = CFString::new(key);
        let value_ref = CFDictionaryGetValue(dict, cf_key.as_concrete_TypeRef() as *const _);
        if value_ref.is_null() {
            return None;
        }

        let mut value: f64 = 0.0;
        if CFNumberGetValue(
            value_ref as CFNumberRef,
            core_foundation::number::kCFNumberFloat64Type,
            &mut value as *mut f64 as *mut _,
        ) {
            Some(value)
        } else {
            None
        }
    }
}

#[cfg(target_os = "linux")]
pub mod linux {
    use super::*;
    use std::env;
    use std::ffi::{CStr, CString};
    use std::mem;
    use std::process::Command;
    use std::ptr;
    use x11::xlib::*;

    /// An RAII guard to temporarily disable GNOME screenshot effects.
    /// It queries and stores the original settings upon creation,
    /// disables them, and restores the original settings when dropped.
    pub struct ScreenshotGuard {
        original_flash_state: bool,
        original_sound_state: bool,
    }

    impl ScreenshotGuard {
        /// Creates a new guard, disabling screenshot effects.
        pub fn new() -> Result<Self, String> {
            // Check if we are likely on GNOME
            if detect_desktop_environment() != "gnome" {
                // Silently succeed on non-GNOME desktops
                return Ok(Self {
                    original_flash_state: false, // Default values, won't be used for restoration
                    original_sound_state: false,
                });
            }

            let original_flash_state =
                get_gsettings_bool("org.gnome.desktop.interface", "enable-animations")
                    .unwrap_or(true); // Default to true if query fails

            let original_sound_state =
                get_gsettings_bool("org.gnome.desktop.sound", "event-sounds").unwrap_or(true); // Default to true if query fails

            // Disable the effects
            set_gsettings_bool("org.gnome.desktop.interface", "enable-animations", false)?;
            set_gsettings_bool("org.gnome.desktop.sound", "event-sounds", false)?;

            Ok(Self {
                original_flash_state,
                original_sound_state,
            })
        }
    }

    impl Drop for ScreenshotGuard {
        fn drop(&mut self) {
            // Only restore if we are on GNOME
            if detect_desktop_environment() != "gnome" {
                return;
            }

            // Restore the original settings.
            // We use `if let Err` to avoid panicking in `drop`.
            if let Err(e) = set_gsettings_bool(
                "org.gnome.desktop.interface",
                "enable-animations",
                self.original_flash_state,
            ) {
                tracing::error!("Failed to restore screenshot flash setting: {}", e);
            }
            if let Err(e) = set_gsettings_bool(
                "org.gnome.desktop.sound",
                "event-sounds",
                self.original_sound_state,
            ) {
                tracing::error!("Failed to restore event sounds setting: {}", e);
            }
        }
    }

    /// Helper to get a boolean value from gsettings.
    fn get_gsettings_bool(schema: &str, key: &str) -> Result<bool, String> {
        let output = Command::new("gsettings")
            .args(["get", schema, key])
            .output()
            .map_err(|e| format!("Failed to execute gsettings: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "gsettings command failed for get {} {}: {}",
                schema,
                key,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let value_str = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_lowercase();
        match value_str.as_str() {
            "true" => Ok(true),
            "false" => Ok(false),
            _ => Err(format!("Unexpected gsettings value: '{}'", value_str)),
        }
    }

    /// Helper to set a boolean value using gsettings.
    fn set_gsettings_bool(schema: &str, key: &str, value: bool) -> Result<(), String> {
        let value_str = if value { "true" } else { "false" };
        let status = Command::new("gsettings")
            .args(["set", schema, key, value_str])
            .status()
            .map_err(|e| format!("Failed to execute gsettings: {}", e))?;

        if !status.success() {
            return Err(format!(
                "gsettings command failed for set {} {} {}",
                schema, key, value_str
            ));
        }
        Ok(())
    }

    pub fn detect_display_server() -> DisplayServer {
        if env::var("WAYLAND_DISPLAY").is_ok() {
            DisplayServer::Wayland
        } else if env::var("DISPLAY").is_ok() {
            DisplayServer::X11
        } else {
            DisplayServer::Unknown
        }
    }

    #[derive(Debug)]
    pub enum DisplayServer {
        X11,
        Wayland,
        Unknown,
    }

    pub fn get_active_window_info() -> Result<WindowProcessInfo, String> {
        match detect_display_server() {
            DisplayServer::X11 => get_active_window_info_x11(),
            DisplayServer::Wayland => get_active_window_info_wayland(),
            DisplayServer::Unknown => Err("Cannot detect display server".to_string()),
        }
    }

    fn get_active_window_info_x11() -> Result<WindowProcessInfo, String> {
        unsafe {
            let display = XOpenDisplay(ptr::null());
            if display.is_null() {
                return Err("Cannot open X display".to_string());
            }

            let root = XDefaultRootWindow(display);
            let active_window: Window;
            let mut actual_type = 0;
            let mut actual_format = 0;
            let mut nitems = 0;
            let mut bytes_after = 0;
            let mut prop_return: *mut u8 = ptr::null_mut();

            // Get the active window property
            let atom_active_window = XInternAtom(
                display,
                CString::new("_NET_ACTIVE_WINDOW").unwrap().as_ptr(),
                0,
            );

            let result = XGetWindowProperty(
                display,
                root,
                atom_active_window,
                0,
                1,
                0,
                XA_WINDOW,
                &mut actual_type,
                &mut actual_format,
                &mut nitems,
                &mut bytes_after,
                &mut prop_return,
            );

            if result == Success as i32 && !prop_return.is_null() && nitems > 0 {
                active_window = *(prop_return as *mut Window);
                XFree(prop_return as *mut _);
            } else {
                XCloseDisplay(display);
                return Err("Cannot get active window".to_string());
            }

            // Get window attributes
            let mut attrs: XWindowAttributes = mem::zeroed();
            if XGetWindowAttributes(display, active_window, &mut attrs) == 0 {
                XCloseDisplay(display);
                return Err("Cannot get window attributes".to_string());
            }

            // Get window title
            let mut window_name: *mut i8 = ptr::null_mut();
            let title = if XFetchName(display, active_window, &mut window_name) != 0
                && !window_name.is_null()
            {
                let c_str = CStr::from_ptr(window_name);
                let title = c_str.to_string_lossy().to_string();
                XFree(window_name as *mut _);
                title
            } else {
                "Unknown".to_string()
            };

            // Get window position relative to root
            let mut root_return = 0;
            let mut parent_return = 0;
            let mut children_return: *mut Window = ptr::null_mut();
            let mut nchildren_return = 0;
            let mut x = 0;
            let mut y = 0;
            let mut child = 0;

            XQueryTree(
                display,
                active_window,
                &mut root_return,
                &mut parent_return,
                &mut children_return,
                &mut nchildren_return,
            );

            if !children_return.is_null() {
                XFree(children_return as *mut _);
            }

            XTranslateCoordinates(
                display,
                active_window,
                root_return,
                0,
                0,
                &mut x,
                &mut y,
                &mut child,
            );

            XCloseDisplay(display);

            Ok(WindowProcessInfo {
                title,
                process_name: "Unknown".to_string(),
                pid: 0,
                x,
                y,
                width: attrs.width as u32,
                height: attrs.height as u32,
            })
        }
    }

    fn get_active_window_info_wayland() -> Result<WindowProcessInfo, String> {
        // For Wayland, we need to use different approaches
        // Try to get window info from compositor-specific commands

        let mut window_info = WindowProcessInfo {
            title: "Active Window".to_string(),
            process_name: "Unknown".to_string(),
            pid: 0,
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        };

        // Detect desktop environment to prioritize the right tools
        let desktop_env = detect_desktop_environment();

        // Try to get detailed info from various sources based on desktop environment
        if desktop_env == "gnome" {
            if let Some(window_info_result) = get_gnome_windows_ext_info() {
                return Ok(window_info_result);
            } else {
                if let Some((title, class)) = get_gnome_window_info() {
                    window_info.title = title;
                    window_info.process_name = class;
                    return Ok(window_info);
                }
            }
        } else if desktop_env == "kde" {
            if let Some((title, class)) = get_kde_window_info() {
                window_info.title = title;
                window_info.process_name = class;
                return Ok(window_info);
            }
        }

        // Try compositor-specific tools
        if let Some((title, app_id, geometry)) = get_sway_window_info() {
            window_info.title = title;
            window_info.process_name = app_id;
            if let Some((x, y, w, h)) = geometry {
                window_info.x = x;
                window_info.y = y;
                window_info.width = w;
                window_info.height = h;
            }
        } else if let Some((title, class)) = get_hyprland_window_info() {
            window_info.title = title;
            window_info.process_name = class;
        } else if let Some(fallback_window_info) = get_gnome_windows_ext_info() {
            window_info = fallback_window_info;
            // Try to get better process name from PID if class is generic
            if window_info.process_name == "Unknown" || window_info.process_name.is_empty() {
                if let Some(proc_name) = get_process_name_from_pid(window_info.pid) {
                    window_info.process_name = proc_name;
                }
            }
        } else if let Some((title, class)) = get_kde_window_info() {
            window_info.title = title;
            window_info.process_name = class;
        } else if let Some((title, class)) = get_gnome_window_info() {
            window_info.title = title;
            window_info.process_name = class;
        } else {
            window_info.title =
                get_wayland_window_title().unwrap_or_else(|| "Active Window".to_string());
            window_info.process_name =
                get_wayland_process_name().unwrap_or_else(|| "Unknown".to_string());
        }

        Ok(window_info)
    }

    fn detect_desktop_environment() -> String {
        // Check various environment variables to detect desktop environment
        if let Ok(desktop) = env::var("XDG_CURRENT_DESKTOP") {
            let desktop_lower = desktop.to_lowercase();
            if desktop_lower.contains("gnome") {
                return "gnome".to_string();
            } else if desktop_lower.contains("kde") || desktop_lower.contains("plasma") {
                return "kde".to_string();
            } else if desktop_lower.contains("sway") {
                return "sway".to_string();
            } else if desktop_lower.contains("hyprland") {
                return "hyprland".to_string();
            }
        }

        if let Ok(session) = env::var("DESKTOP_SESSION") {
            let session_lower = session.to_lowercase();
            if session_lower.contains("gnome") {
                return "gnome".to_string();
            } else if session_lower.contains("kde") || session_lower.contains("plasma") {
                return "kde".to_string();
            }
        }

        if let Ok(wayland_compositor) = env::var("WAYLAND_COMPOSITOR") {
            let compositor_lower = wayland_compositor.to_lowercase();
            if compositor_lower.contains("sway") {
                return "sway".to_string();
            } else if compositor_lower.contains("hyprland") {
                return "hyprland".to_string();
            }
        }

        "unknown".to_string()
    }

    fn get_sway_window_info() -> Option<(String, String, Option<(i32, i32, u32, u32)>)> {
        let output = Command::new("swaymsg")
            .args(["-t", "get_tree"])
            .output()
            .ok()?;
        let tree_str = String::from_utf8(output.stdout).ok()?;

        // Find the focused window in the JSON
        let focused_start = tree_str.find("\"focused\":true")?;
        let window_start = tree_str[..focused_start].rfind("{")?;
        let window_end = tree_str[focused_start..]
            .find("}")
            .map(|pos| focused_start + pos)?;
        let window_json = &tree_str[window_start..=window_end];

        let mut title = "Unknown".to_string();
        let mut app_id = "Unknown".to_string();
        let mut geometry: Option<(i32, i32, u32, u32)> = None;

        // Parse title
        if let Some(name_start) = window_json.find("\"name\":\"") {
            let name_start = name_start + 8;
            if let Some(name_end) = window_json[name_start..].find("\"") {
                title = window_json[name_start..name_start + name_end].to_string();
            }
        }

        // Parse app_id
        if let Some(app_start) = window_json.find("\"app_id\":\"") {
            let app_start = app_start + 10;
            if let Some(app_end) = window_json[app_start..].find("\"") {
                app_id = window_json[app_start..app_start + app_end].to_string();
            }
        }

        // Parse geometry (simplified)
        if let Some(rect_start) = window_json.find("\"rect\":{") {
            let rect_section = &window_json[rect_start..];
            if let Some(x_start) = rect_section.find("\"x\":") {
                let x_val = parse_json_number(&rect_section[x_start + 4..]).unwrap_or(0);
                if let Some(y_start) = rect_section.find("\"y\":") {
                    let y_val = parse_json_number(&rect_section[y_start + 4..]).unwrap_or(0);
                    if let Some(w_start) = rect_section.find("\"width\":") {
                        let w_val =
                            parse_json_number(&rect_section[w_start + 8..]).unwrap_or(1920) as u32;
                        if let Some(h_start) = rect_section.find("\"height\":") {
                            let h_val = parse_json_number(&rect_section[h_start + 9..])
                                .unwrap_or(1080) as u32;
                            geometry = Some((x_val, y_val, w_val, h_val));
                        }
                    }
                }
            }
        }

        Some((title, app_id, geometry))
    }

    fn get_hyprland_window_info() -> Option<(String, String)> {
        let output = Command::new("hyprctl")
            .args(["activewindow"])
            .output()
            .ok()?;
        let info = String::from_utf8(output.stdout).ok()?;

        let mut title = "Unknown".to_string();
        let mut class = "Unknown".to_string();

        for line in info.lines() {
            if line.starts_with("title: ") {
                title = line[7..].to_string();
            } else if line.starts_with("class: ") {
                class = line[7..].to_string();
            }
        }

        Some((title, class))
    }

    fn get_gnome_window_info() -> Option<(String, String)> {
        // Try Windows extension first (requires installation)
        if let Some(window_info) = get_gnome_windows_ext_info() {
            return Some((window_info.title, window_info.process_name));
        }

        // Fallback: try wmctrl if available
        if let Ok(wmctrl_output) = Command::new("wmctrl").args(["-l"]).output() {
            if let Ok(wmctrl_str) = String::from_utf8(wmctrl_output.stdout) {
                // wmctrl output format: window_id desktop pid machine_name window_title
                for line in wmctrl_str.lines() {
                    if line.contains("*") {
                        // Active window marker in some versions
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 5 {
                            let title = parts[4..].join(" ");
                            return Some((title, "Unknown".to_string()));
                        }
                    }
                }
            }
        }

        None
    }

    fn get_gnome_windows_ext_info() -> Option<WindowProcessInfo> {
        // Get windows list using Windows extension
        let output = Command::new("gdbus")
            .args([
                "call",
                "--session",
                "--dest",
                "org.gnome.Shell",
                "--object-path",
                "/org/gnome/Shell/Extensions/Windows",
                "--method",
                "org.gnome.Shell.Extensions.Windows.List",
            ])
            .output()
            .ok()?;

        let output_str = String::from_utf8(output.stdout).ok()?;

        // Find the start and end of the JSON array within the gdbus output.
        let json_start = match output_str.find('[') {
            Some(start) => start,
            None => {
                tracing::error!("Could not find start of JSON array '[' in gdbus output.");
                return None;
            }
        };
        let json_end = match output_str.rfind(']') {
            Some(end) => end + 1, // Include the closing bracket
            None => {
                tracing::error!("Could not find end of JSON array ']' in gdbus output.");
                return None;
            }
        };

        // Extract the raw JSON substring.
        let raw_json_slice = &output_str[json_start..json_end];

        // Unescape characters for valid JSON. gdbus escapes quotes and backslashes.
        let json_str = raw_json_slice.replace("\\\"", "\"").replace("\\\\", "\\");

        // Parse JSON array
        let windows: Vec<serde_json::Value> = match serde_json::from_str(&json_str) {
            Ok(w) => w,
            Err(e) => {
                tracing::error!("Failed to parse JSON: {}", e);
                tracing::error!("JSON string was: {}", json_str);
                return None;
            }
        };

        // Find the focused window
        for window in &windows {
            if let Some(focus) = window.get("focus") {
                if focus.as_bool() == Some(true) {
                    // Get the window ID for detailed info
                    let window_id = window.get("id").and_then(|v| v.as_u64())?;

                    // Get detailed window information using the Details method
                    let details_output = Command::new("gdbus")
                        .args([
                            "call",
                            "--session",
                            "--dest",
                            "org.gnome.Shell",
                            "--object-path",
                            "/org/gnome/Shell/Extensions/Windows",
                            "--method",
                            "org.gnome.Shell.Extensions.Windows.Details",
                            &window_id.to_string(),
                        ])
                        .output()
                        .ok()?;

                    let details_str = String::from_utf8(details_output.stdout).ok()?;

                    // Parse the gdbus response format: ('JSON',)
                    let json_start = details_str.find('{')?;
                    let json_end = details_str.rfind('}')? + 1;
                    let details_json_str = &details_str[json_start..json_end];

                    // Parse detailed window info
                    let detailed_window: serde_json::Value = match serde_json::from_str(
                        details_json_str,
                    ) {
                        Ok(w) => w,
                        Err(e) => {
                            tracing::error!("Failed to parse detailed window JSON: {}. Falling back to basic window info.", e);
                            // Fall back to basic window info if detailed parsing fails
                            window.clone()
                        }
                    };

                    let title = detailed_window
                        .get("title")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    let process_name = detailed_window
                        .get("wm_class")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    let pid = detailed_window
                        .get("pid")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as u32;

                    let x = detailed_window
                        .get("x")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32;
                    let y = detailed_window
                        .get("y")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32;
                    let width = detailed_window
                        .get("width")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(1920) as u32;
                    let height = detailed_window
                        .get("height")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(1080) as u32;

                    return Some(WindowProcessInfo {
                        title,
                        process_name,
                        pid,
                        x,
                        y,
                        width,
                        height,
                    });
                }
            }
        }

        None
    }

    fn get_process_name_from_pid(pid: u32) -> Option<String> {
        // Try to get process name from /proc/pid/comm
        if let Ok(comm) = std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
            let comm = comm.trim();
            if !comm.is_empty() {
                return Some(comm.to_string());
            }
        }

        // Fallback: try to get from /proc/pid/cmdline
        if let Ok(cmdline) = std::fs::read_to_string(format!("/proc/{}/cmdline", pid)) {
            let parts: Vec<&str> = cmdline.split('\0').collect();
            if let Some(first_part) = parts.first() {
                if let Some(filename) = first_part.split('/').last() {
                    if !filename.is_empty() {
                        return Some(filename.to_string());
                    }
                }
            }
        }

        None
    }

    fn get_kde_window_info() -> Option<(String, String)> {
        // Try qdbus to get window info from KDE Plasma
        let output = Command::new("qdbus")
            .args(["org.kde.KWin", "/KWin", "org.kde.KWin.activeWindow"])
            .output()
            .ok()?;

        let window_id = String::from_utf8(output.stdout).ok()?.trim().to_string();
        if window_id.is_empty() || window_id == "0" {
            return None;
        }

        // Get window title
        let title_output = Command::new("qdbus")
            .args([
                "org.kde.KWin",
                &format!("/KWin/Window_{}", window_id),
                "org.kde.KWin.Window.caption",
            ])
            .output()
            .ok()?;

        let title = String::from_utf8(title_output.stdout)
            .ok()?
            .trim()
            .to_string();

        // Get window class
        let class_output = Command::new("qdbus")
            .args([
                "org.kde.KWin",
                &format!("/KWin/Window_{}", window_id),
                "org.kde.KWin.Window.resourceClass",
            ])
            .output()
            .ok()?;

        let class = String::from_utf8(class_output.stdout)
            .ok()?
            .trim()
            .to_string();

        // Fallback: try kwinctl if available (newer KDE versions)
        if title.is_empty() || class.is_empty() {
            if let Ok(kwinctl_output) = Command::new("kwinctl").args(["window", "--list"]).output()
            {
                if let Ok(kwinctl_str) = String::from_utf8(kwinctl_output.stdout) {
                    for line in kwinctl_str.lines() {
                        if line.contains("ACTIVE") {
                            // Parse kwinctl output for active window
                            let parts: Vec<&str> = line.split('\t').collect();
                            if parts.len() >= 3 {
                                return Some((parts[1].to_string(), parts[2].to_string()));
                            }
                        }
                    }
                }
            }
        }

        if !title.is_empty() || !class.is_empty() {
            Some((
                if title.is_empty() {
                    "Unknown".to_string()
                } else {
                    title
                },
                if class.is_empty() {
                    "Unknown".to_string()
                } else {
                    class
                },
            ))
        } else {
            None
        }
    }

    fn parse_json_number(s: &str) -> Option<i32> {
        let end = s.find(|c: char| !c.is_ascii_digit() && c != '-')?;
        s[..end].parse().ok()
    }

    fn get_wayland_window_title() -> Option<String> {
        // Check environment variables first
        if let Ok(title) = env::var("WAYLAND_WINDOW_TITLE") {
            return Some(title);
        }

        // Try generic tools that might work across compositors
        if let Ok(output) = Command::new("xdotool")
            .args(["getactivewindow", "getwindowname"])
            .output()
        {
            if output.status.success() {
                if let Ok(title) = String::from_utf8(output.stdout) {
                    let title = title.trim();
                    if !title.is_empty() {
                        return Some(title.to_string());
                    }
                }
            }
        }

        // Try wlrctl for wlroots-based compositors
        if let Ok(output) = Command::new("wlrctl").args(["window", "focus"]).output() {
            if output.status.success() {
                if let Ok(info) = String::from_utf8(output.stdout) {
                    for line in info.lines() {
                        if line.starts_with("title: ") {
                            return Some(line[7..].to_string());
                        }
                    }
                }
            }
        }

        None
    }

    fn get_wayland_process_name() -> Option<String> {
        // Try to get the focused application name
        // This is simplified - a full implementation would use D-Bus or other IPC

        // Try common environment variables
        if let Ok(app) = env::var("WAYLAND_APP_ID") {
            return Some(app);
        }

        // Try generic tools
        if let Ok(output) = Command::new("xdotool")
            .args(["getactivewindow", "getwindowpid"])
            .output()
        {
            if output.status.success() {
                if let Ok(pid_str) = String::from_utf8(output.stdout) {
                    if let Ok(pid) = pid_str.trim().parse::<u32>() {
                        // Try to get process name from /proc/pid/comm
                        if let Ok(comm) = std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
                            return Some(comm.trim().to_string());
                        }
                    }
                }
            }
        }

        // Try wlrctl for wlroots-based compositors
        if let Ok(output) = Command::new("wlrctl").args(["window", "focus"]).output() {
            if output.status.success() {
                if let Ok(info) = String::from_utf8(output.stdout) {
                    for line in info.lines() {
                        if line.starts_with("app_id: ") {
                            return Some(line[8..].to_string());
                        }
                    }
                }
            }
        }

        // Try riverctl for River compositor
        if let Ok(output) = Command::new("riverctl").args(["focused-view"]).output() {
            if output.status.success() {
                if let Ok(info) = String::from_utf8(output.stdout) {
                    // River outputs app_id directly
                    let app_id = info.trim();
                    if !app_id.is_empty() {
                        return Some(app_id.to_string());
                    }
                }
            }
        }

        None
    }
}

// Public API
#[tauri_crate::command]
pub fn get_active_window_info() -> Result<WindowProcessInfo, String> {
    #[cfg(target_os = "windows")]
    return windows::get_active_window_info();

    #[cfg(target_os = "macos")]
    return macos::get_active_window_info();

    #[cfg(target_os = "linux")]
    return linux::get_active_window_info();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Platform not supported".to_string());
}

pub fn capture_active_window() -> Result<image::RgbaImage, String> {
    // Get active window information
    let window_info =
        get_active_window_info().map_err(|e| format!("Failed to get window info: {}", e))?;

    // Validate coordinates and dimensions
    if window_info.width == 0 || window_info.height == 0 {
        return Err(format!(
            "Invalid window dimensions: {}x{}",
            window_info.width, window_info.height
        ));
    }

    // Get all screens
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    // Use the primary screen (first screen)
    let screen = &screens[0];

    // Ensure coordinates are non-negative and within reasonable bounds
    let x = window_info.x.max(0) as i32;
    let y = window_info.y.max(0) as i32;
    let width = window_info.width as u32;
    let height = window_info.height as u32;

    // Capture the window area using the coordinates from WindowProcessInfo
    let image = screen.capture_area(x, y, width, height).map_err(|e| {
        format!(
            "Failed to capture window area at ({}, {}) with size {}x{}: {}",
            x, y, width, height, e
        )
    })?;

    // Convert from screenshots::image (v0.24.9) to image (v0.25.8)
    // We need to go through raw bytes to bridge the version gap
    let raw_image = image::RgbaImage::from_raw(image.width(), image.height(), image.into_raw())
        .ok_or_else(|| "Failed to convert image format".to_string())?;

    Ok(raw_image)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_active_window_info() {
        // This test will verify that the function doesn't panic
        // The actual result depends on the platform and current state
        match get_active_window_info() {
            Ok(info) => {
                println!("Window info: {:?}", info);
                assert!(!info.title.is_empty() || info.title == "Unknown");
                assert!(!info.process_name.is_empty() || info.process_name == "Unknown");
            }
            Err(e) => {
                println!("Error getting window info: {}", e);
                // This is acceptable in test environments
            }
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_display_server_detection() {
        use linux::detect_display_server;
        let server = detect_display_server();
        println!("Detected display server: {:?}", server);
        // Just verify it doesn't panic
    }

    #[cfg(target_os = "linux")]
    #[test]
    pub fn test_get_gnome_windows_ext_info() {
        // Get windows list using Windows extension

        use std::process::Command;
        let output = Command::new("gdbus")
            .args([
                "call",
                "--session",
                "--dest",
                "org.gnome.Shell",
                "--object-path",
                "/org/gnome/Shell/Extensions/Windows",
                "--method",
                "org.gnome.Shell.Extensions.Windows.List",
            ])
            .output()
            .unwrap();

        let output_str = String::from_utf8(output.stdout).ok().unwrap();

        // Find the start and end of the JSON array within the gdbus output.
        let json_start = match output_str.find('[') {
            Some(start) => start,
            None => {
                #[cfg(debug_assertions)]
                eprintln!("Debug: Could not find start of JSON array '[' in gdbus output.");
                return;
            }
        };
        let json_end = match output_str.rfind(']') {
            Some(end) => end + 1, // Include the closing bracket
            None => {
                #[cfg(debug_assertions)]
                eprintln!("Debug: Could not find end of JSON array ']' in gdbus output.");
                return;
            }
        };

        // Extract the raw JSON substring.
        let raw_json_slice = &output_str[json_start..json_end];

        // Unescape characters for valid JSON. gdbus escapes quotes and backslashes.
        let json_str = raw_json_slice.replace("\\\"", "\"").replace("\\\\", "\\");

        // Parse JSON array
        let windows: Vec<serde_json::Value> = match serde_json::from_str(&json_str) {
            Ok(w) => w,
            Err(_e) => {
                #[cfg(debug_assertions)]
                eprintln!("Debug: Failed to parse JSON: {}", _e);
                #[cfg(debug_assertions)]
                eprintln!("Debug: JSON string was: {}", json_str);
                return;
            }
        };

        // Find the focused window
        for window in &windows {
            // Get the window ID for detailed info
            let window_id = window.get("id").and_then(|v| v.as_u64()).unwrap();

            // Get detailed window information using the Details method
            let details_output = Command::new("gdbus")
                .args([
                    "call",
                    "--session",
                    "--dest",
                    "org.gnome.Shell",
                    "--object-path",
                    "/org/gnome/Shell/Extensions/Windows",
                    "--method",
                    "org.gnome.Shell.Extensions.Windows.Details",
                    &window_id.to_string(),
                ])
                .output()
                .ok()
                .unwrap();

            let details_str = String::from_utf8(details_output.stdout).ok().unwrap();

            // Parse the gdbus response format: ('JSON',)
            let json_start = details_str.find('{').unwrap();
            let json_end = details_str.rfind('}').unwrap() + 1;
            let details_json_str = &details_str[json_start..json_end];

            // Parse detailed window info
            let detailed_window: serde_json::Value = match serde_json::from_str(details_json_str) {
                Ok(w) => w,
                Err(_e) => {
                    #[cfg(debug_assertions)]
                    eprintln!("Debug: Failed to parse detailed window JSON: {}", _e);
                    #[cfg(debug_assertions)]
                    eprintln!("Debug: JSON string was: {}", details_json_str);
                    // Fall back to basic window info if detailed parsing fails
                    window.clone()
                }
            };

            let title = detailed_window
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            let process_name = detailed_window
                .get("wm_class")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            let pid = detailed_window
                .get("pid")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32;

            let x = detailed_window
                .get("x")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            let y = detailed_window
                .get("y")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            let width = detailed_window
                .get("width")
                .and_then(|v| v.as_u64())
                .unwrap_or(1920) as u32;
            let height = detailed_window
                .get("height")
                .and_then(|v| v.as_u64())
                .unwrap_or(1080) as u32;

            let window_process_info = WindowProcessInfo {
                title,
                process_name,
                pid,
                x,
                y,
                width,
                height,
            };

            println!("Window Process Info: {:?}", window_process_info);
        }
    }
}
