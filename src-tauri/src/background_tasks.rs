use crate::contextual_bandit::manager;
use crate::llm::{image_analysis, user_intention};
use crate::sql;
use crate::get_current_user_internal;
use crate::window_manager::get_active_window_info;
use crate::tauri::user::{get_all_users, user_profile};
use crate::tauri::group::get_group_list;
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration};
use libqaul::services::group::{GroupManage, GroupStorage};

// Task handle storage
static INTENTION_TASK_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
static SCREENSHOT_TASK_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
static DASHBOARD_STATS_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
static DATA_SYNC_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

/// Starts automatic user intention analysis at regular intervals
async fn start_automatic_intention_analysis(
    app_handle: AppHandle,
    interval_minutes: u64,
    window_time_minutes: u64,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();

    let handle = tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(tokio::time::Duration::from_secs(interval_minutes * 60));

        // The first tick returns immediately, so we need to wait for it to complete
        interval.tick().await;

        loop {
            interval.tick().await;

            match user_intention::analyze_current_user_intention(
                &app_handle_clone,
                Some(window_time_minutes), // last window_time_minutes minutes
                false,                     // is not testing
            )
            .await
            {
                Ok(intention_data) => {
                    tracing::info!(
                        "Automatic analysis: {} - {}",
                        intention_data.llm_user_state,
                        intention_data.llm_user_intention
                    );

                    // Generate bandit context and determine chosen arm
                    match manager::generate_bandit_context(&intention_data) {
                        Ok(bandit_context) => {
                            match manager::determine_chosen_arm_and_notify(
                                &app_handle_clone,
                                &bandit_context,
                                false, // from_test is false here, so we train the model
                            )
                            .await
                            {
                                Ok(chosen_arm) => tracing::info!(
                                    "Bandit decision for user intention: {} (0=no_assist, 1=assist)",
                                    chosen_arm
                                ),
                                Err(e) => tracing::error!("Failed to determine chosen arm: {}", e),
                            }
                        }
                        Err(e) => tracing::error!("Failed to generate bandit context: {}", e),
                    }
                }
                Err(e) => {
                    // Don't log every error as it's normal to have periods without transitions
                    if !e.contains("No transitions found") {
                        tracing::error!("User intention analysis failed: {}", e);
                    }
                }
            }
        }
    });

    // Store the handle
    let mut task_handle = INTENTION_TASK_HANDLE.lock().unwrap();
    *task_handle = Some(handle);

    Ok(())
}

/// Starts automatic screenshot taking at regular intervals
async fn start_automatic_screenshots(
    app_handle: AppHandle,
    interval_seconds: u64,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();

    let handle = tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(tokio::time::Duration::from_secs(interval_seconds));

        // The first tick returns immediately, so we need to wait for it to complete
        interval.tick().await;

        loop {
            interval.tick().await;

            match image_analysis::take_screenshot(
                app_handle_clone.clone(),
                "window".to_string(),
                false, // is not testing
            )
            .await
            {
                Ok(window_info) => {
                    if !window_info.llm_description.is_empty() {
                        tracing::info!(
                            "Automatic screenshot: {} - {}",
                            window_info.title,
                            window_info.llm_category
                        );
                    }
                }
                Err(e) => {
                    if !e.contains("Avoiding reprocessing") {
                        tracing::error!("Automatic screenshot failed: {}", e);
                    } else {
                        tracing::warn!("{}", e);
                    }
                }
            }
        }
    });

    // Store the handle
    let mut task_handle = SCREENSHOT_TASK_HANDLE.lock().unwrap();
    *task_handle = Some(handle);

    Ok(())
}

/// Starts automatic dashboard statistics updates at regular intervals
async fn start_dashboard_stats_updates(
    app_handle: AppHandle,
    interval_seconds: u64,
) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();

    let handle = tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(tokio::time::Duration::from_secs(interval_seconds));

        // The first tick returns immediately, so we need to wait for it to complete
        interval.tick().await;

        loop {
            interval.tick().await;

            // Get current user
            let current_user = match get_current_user_internal() {
                Some(user) => user,
                None => {
                    tracing::warn!("No current user found for dashboard stats update");
                    continue;
                }
            };

            let account_id = current_user.id;

            // Get current statistics
            let group_list = GroupManage::group_list(&account_id);
            let total_groups = group_list.groups.len() as u32;
            let direct_chats = group_list.groups.iter()
                .filter(|group| group.is_direct_chat)
                .count() as u32;
            let total_unread = GroupStorage::group_get_total_unread_count(account_id);

            // Emit events to frontend
            if let Err(e) = app_handle_clone.emit("total_groups_updated", total_groups) {
                tracing::error!("Failed to emit total_groups_updated event: {}", e);
            }

            if let Err(e) = app_handle_clone.emit("direct_chats_updated", direct_chats) {
                tracing::error!("Failed to emit direct_chats_updated event: {}", e);
            }

            if let Err(e) = app_handle_clone.emit("total_unread_count_updated", total_unread) {
                tracing::error!("Failed to emit total_unread_count_updated event: {}", e);
            }

            // Also emit combined dashboard stats event
            let dashboard_stats = serde_json::json!({
                "total_groups": total_groups,
                "direct_chats": direct_chats,
                "total_unread_messages": total_unread
            });

            if let Err(e) = app_handle_clone.emit("dashboard_stats_updated", dashboard_stats) {
                tracing::error!("Failed to emit dashboard_stats_updated event: {}", e);
            }

            tracing::debug!(
                "Dashboard stats updated - Groups: {}, Direct chats: {}, Unread: {}",
                total_groups, direct_chats, total_unread
            );
        }
    });

    // Store the handle
    let mut task_handle = DASHBOARD_STATS_HANDLE.lock().unwrap();
    *task_handle = Some(handle);

    Ok(())
}

/// Stop all background tasks
#[tauri_crate::command]
pub async fn stop_all_background_tasks() -> Result<(), String> {
    // Stop intention analysis
    let mut intention_handle = INTENTION_TASK_HANDLE.lock().unwrap();
    if let Some(handle) = intention_handle.take() {
        handle.abort();
        tracing::info!("Stopped automatic intention analysis");
    }

    // Stop screenshots
    let mut screenshot_handle = SCREENSHOT_TASK_HANDLE.lock().unwrap();
    if let Some(handle) = screenshot_handle.take() {
        handle.abort();
        tracing::info!("Stopped automatic screenshots");
    }

    // Stop dashboard stats
    let mut dashboard_handle = DASHBOARD_STATS_HANDLE.lock().unwrap();
    if let Some(handle) = dashboard_handle.take() {
        handle.abort();
        tracing::info!("Stopped dashboard statistics updates");
    }

    // Stop data sync
    let mut data_sync_handle = DATA_SYNC_HANDLE.lock().unwrap();
    if let Some(handle) = data_sync_handle.take() {
        handle.abort();
        tracing::info!("Stopped background data sync service");
    }

    Ok(())
}

/// Parse delay string, with fallback to default
fn parse_delay(delay_str: &str, default: u64) -> u64 {
    delay_str.parse::<u64>().unwrap_or(default)
}

/// Start background tasks based on global configuration
async fn start_background_tasks_from_config(app_handle: AppHandle) -> Result<String, String> {
    let config = sql::get_config().map_err(|e| format!("Failed to get config: {}", e))?;

    // Check if background tasks are enabled
    if config.enable_background_tasks != "true" {
        return Ok("Background tasks are disabled in configuration".to_string());
    }

    // Parse delay values with defaults
    let screenshot_delay = parse_delay(&config.screenshot_delay, 10); // seconds
    let intention_delay = parse_delay(&config.user_intention_delay, 15); // minutes
    let window_time_minutes = parse_delay(&config.window_time_minutes, 3600); // minutes
    let dashboard_stats_delay = parse_delay(&config.dashboard_stats_delay, 30); // seconds

    // Start screenshot task
    if screenshot_delay > 0 {
        start_automatic_screenshots(app_handle.clone(), screenshot_delay).await?;
        tracing::info!(
            "Started automatic screenshots with {} second intervals",
            screenshot_delay
        );
    }

    // Start intention analysis task
    if intention_delay > 0 {
        start_automatic_intention_analysis(app_handle.clone(), intention_delay, window_time_minutes)
            .await?;
        tracing::info!(
            "Started automatic intention analysis with {} minute intervals",
            intention_delay
        );
    }

    // Start dashboard stats task
    if dashboard_stats_delay > 0 {
        start_dashboard_stats_updates(app_handle, dashboard_stats_delay).await?;
        tracing::info!(
            "Started dashboard statistics updates with {} second intervals",
            dashboard_stats_delay
        );
    }

    Ok(format!(
        "Started background tasks - Screenshots: {} sec, Intention Analysis: {} min, Dashboard Stats: {} sec",
        screenshot_delay, intention_delay, dashboard_stats_delay
    ))
}

/// Unified command to manage background tasks based on global configuration
#[tauri_crate::command]
pub async fn manage_background_tasks(app_handle: AppHandle) -> Result<String, String> {
    // First stop any existing tasks
    stop_all_background_tasks().await?;

    // Then start tasks based on current configuration
    start_background_tasks_from_config(app_handle).await
}

/// Initialize background task management system
#[tauri_crate::command]
pub fn init_background_task_manager(app_handle: AppHandle) {
    // Start initial background tasks
    tauri::async_runtime::spawn(async move {
        if let Err(e) = manage_background_tasks(app_handle).await {
            tracing::error!("Failed to start initial background tasks: {}", e);
        }
    });
}

/// Get status of background tasks
#[tauri_crate::command]
pub async fn get_background_tasks_status() -> Result<serde_json::Value, String> {
    let intention_running = INTENTION_TASK_HANDLE.lock().unwrap().is_some();
    let screenshots_running = SCREENSHOT_TASK_HANDLE.lock().unwrap().is_some();
    let dashboard_stats_running = DASHBOARD_STATS_HANDLE.lock().unwrap().is_some();
    let data_sync_running = DATA_SYNC_HANDLE.lock().unwrap().is_some();

    let config = sql::get_config().map_err(|e| format!("Failed to get config: {}", e))?;
    let enabled = config.enable_background_tasks == "true";
    let screenshot_delay = parse_delay(&config.screenshot_delay, 10);
    let intention_delay = parse_delay(&config.user_intention_delay, 15) * 60;
    let dashboard_stats_delay = parse_delay(&config.dashboard_stats_delay, 30);

    Ok(serde_json::json!({
        "enabled": enabled,
        "intention_analysis_running": intention_running,
        "screenshots_running": screenshots_running,
        "dashboard_stats_running": dashboard_stats_running,
        "data_sync_running": data_sync_running,
        "screenshot_delay_seconds": screenshot_delay,
        "intention_delay_minutes": intention_delay,
        "dashboard_stats_delay_seconds": dashboard_stats_delay
    }))
}

/// Background data sync service that periodically fetches data and emits events
async fn background_data_sync_service(app_handle: AppHandle) {
    let mut interval = interval(Duration::from_millis(2000)); // Update every 2 seconds (reduced from 500ms)
    let mut is_focused = true; // Start with focused state
    let mut consecutive_failures = 0; // Track consecutive failures
    
    loop {
        interval.tick().await;
        
        // Check if app is focused by checking if our window is active
        // Only check focus every other cycle to reduce spam
        if consecutive_failures < 3 {
            match get_active_window_info() {
                Ok(window_info) => {
                    consecutive_failures = 0; // Reset failure counter on success
                    
                    // Check if the active window is our app by looking for common identifiers
                    let current_is_focused = window_info.title.to_lowercase().contains("knowlia") || 
                                           window_info.process_name.to_lowercase().contains("knowlia") ||
                                           window_info.title.to_lowercase().contains("com.knowlia.dev") ||
                                           window_info.process_name.to_lowercase().contains("knowlia.exe") ||
                                           window_info.title.to_lowercase().contains("dashboard") ||
                                           // Fallback: check if it's a Tauri app window
                                           window_info.process_name.to_lowercase().contains("tauri") ||
                                           window_info.title.to_lowercase().contains("main") ||
                                           // If window title is empty or generic, assume we're focused
                                           window_info.title.is_empty() || 
                                           window_info.title == "main";
                    
                    // Log focus state changes and window info for debugging
                    if current_is_focused != is_focused {
                        tracing::info!("Window focus changed - Title: '{}', Process: '{}', Focused: {}", 
                                      window_info.title, window_info.process_name, current_is_focused);
                        
                        if current_is_focused {
                            tracing::info!("App gained focus, resuming background sync");
                        } else {
                            tracing::info!("App lost focus, pausing background sync");
                        }
                        is_focused = current_is_focused;
                    }
                    
                    // Only sync when app is focused
                    if !is_focused {
                        continue;
                    }
                }
                Err(e) => {
                    consecutive_failures += 1;
                    tracing::warn!("Failed to check window focus ({}): {}", consecutive_failures, e);
                    
                    // After 3 consecutive failures, assume we're focused and skip checks for a while
                    if consecutive_failures >= 3 {
                        tracing::warn!("Too many focus detection failures, assuming app is focused for 30 seconds");
                        is_focused = true; // Assume focused to avoid breaking functionality
                        consecutive_failures = 0; // Reset counter
                        
                        // Skip focus checks for 15 cycles (30 seconds)
                        for _ in 0..15 {
                            interval.tick().await;
                        }
                    }
                }
            }
        }
        
        // Fetch total unread count
        match crate::tauri::group::get_total_unread_count().await {
            Ok(count) => {
                if let Err(e) = app_handle.emit("total_unread_count_updated", count) {
                    tracing::error!("Failed to emit total_unread_count_updated: {}", e);
                } else {
                    tracing::debug!("Emitted total_unread_count_updated: {}", count);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch total unread count: {}", e);
            }
        }
        
        // Fetch user profile
        match user_profile().await {
            Ok(profile) => {
                if let Err(e) = app_handle.emit("user_profile_updated", profile) {
                    tracing::error!("Failed to emit user_profile_updated: {}", e);
                } else {
                    tracing::debug!("Emitted user_profile_updated");
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch user profile: {}", e);
            }
        }
        
        // Fetch network stats
        match crate::tauri::qaul::get_network_stats() {
            Ok(stats) => {
                if let Err(e) = app_handle.emit("network_stats_updated", stats) {
                    tracing::error!("Failed to emit network_stats_updated: {}", e);
                } else {
                    tracing::debug!("Emitted network_stats_updated");
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch network stats: {}", e);
            }
        }
        
        // Fetch internet neighbours
        match crate::tauri::qaul::get_internet_neighbours_ui_command() {
            Ok(neighbours) => {
                if let Err(e) = app_handle.emit("internet_neighbours_updated", &neighbours) {
                    tracing::error!("Failed to emit internet_neighbours_updated: {}", e);
                } else {
                    tracing::debug!("Emitted internet_neighbours_updated: {} neighbours", neighbours.len());
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch internet neighbours: {}", e);
            }
        }
        
        // Fetch all network users for graph view
        match get_all_users().await {
            Ok(users_json) => {
                if let Err(e) = app_handle.emit("neighbors-updated", &users_json) {
                    tracing::error!("Failed to emit neighbors-updated: {}", e);
                } else {
                    tracing::debug!("Emitted neighbors-updated event");
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch network users for update: {}", e);
            }
        }
        
        // Fetch all groups for dashboard
        match get_group_list().await {
            Ok(groups) => {
                match serde_json::to_string(&groups) {
                    Ok(groups_json) => {
                        if let Err(e) = app_handle.emit("groups-updated", &groups_json) {
                            tracing::error!("Failed to emit groups-updated: {}", e);
                        } else {
                            tracing::debug!("Emitted groups-updated: {} groups", groups.len());
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to serialize groups to JSON: {}", e);
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch groups: {}", e);
            }
        }
    }
}
