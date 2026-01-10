pub mod error;
pub mod main;
pub mod model;
pub mod queries;
use chrono::{DateTime, Duration, TimeZone, Utc};
use tauri;

pub use main::{get_config, get_conn, init};

/// Converts a date string in SQLite Timestamp format to UTC DateTime.
pub fn convert_date_str_to_utc(date_str: &str) -> Result<DateTime<Utc>, rusqlite::Error> {
    // SQLite CURRENT_TIMESTAMP format is "YYYY-MM-DD HH:MM:SS"
    let created_at = if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        dt.with_timezone(&Utc)
    } else if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S") {
        Utc.from_utc_datetime(&naive)
    } else {
        return Err(rusqlite::Error::InvalidColumnType(
            0,
            "created_at".to_string(),
            rusqlite::types::Type::Text,
        ));
    };

    Ok(created_at)
}

#[tauri_crate::command]
pub async fn get_global_config() -> Result<model::GlobalConfig, String> {
    let config = get_config()?;
    Ok(config)
}

#[tauri_crate::command]
pub async fn get_window_info_by_pid(
    pid: u32,
    limit: u32,
) -> Result<Vec<model::WindowInfoData>, String> {
    queries::get_window_info_by_pid(pid, limit)
        .map_err(|e| format!("Failed to get window info: {}", e))
}

#[tauri_crate::command]
pub async fn get_all_apps() -> Result<Vec<model::AppData>, String> {
    let end_time = Utc::now();
    let start_time = end_time - Duration::days(30);
    queries::get_apps_in_time_window(None, start_time, end_time)
        .map_err(|e| format!("Failed to get all apps: {}", e))
}

#[tauri_crate::command]
pub async fn get_apps_by_time_range(hours: i64) -> Result<Vec<model::AppData>, String> {
    let end_time = Utc::now();
    let start_time = end_time - Duration::hours(hours);
    queries::get_apps_in_time_window(None, start_time, end_time)
        .map_err(|e| format!("Failed to get apps by time range: {}", e))
}

#[tauri_crate::command]
pub async fn get_window_info_by_pid_and_time(
    pid: u32,
    limit: u32,
    hours: Option<i64>,
) -> Result<Vec<model::WindowInfoData>, String> {
    match hours {
        Some(h) => {
            let end_time = Utc::now();
            let start_time = end_time - Duration::hours(h);
            queries::get_window_info_by_pid_in_time_range(pid, limit, start_time, end_time)
                .map_err(|e| format!("Failed to get window info by time range: {}", e))
        }
        None => queries::get_window_info_by_pid(pid, limit)
            .map_err(|e| format!("Failed to get window info: {}", e)),
    }
}
