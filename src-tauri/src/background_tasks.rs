use crate::contextual_bandit::manager;
use crate::llm::{image_analysis, user_intention};

use crate::sql;
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::task::JoinHandle;

// Task handle storage
static INTENTION_TASK_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));
static SCREENSHOT_TASK_HANDLE: Lazy<Arc<Mutex<Option<JoinHandle<()>>>>> =
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

/// Stop all background tasks
#[tauri::command]
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
        start_automatic_intention_analysis(app_handle, intention_delay, window_time_minutes)
            .await?;
        tracing::info!(
            "Started automatic intention analysis with {} minute intervals",
            intention_delay
        );
    }

    Ok(format!(
        "Started background tasks - Screenshots: {} min, Intention Analysis: {} min",
        screenshot_delay, intention_delay
    ))
}

/// Unified command to manage background tasks based on global configuration
#[tauri::command]
pub async fn manage_background_tasks(app_handle: AppHandle) -> Result<String, String> {
    // First stop any existing tasks
    stop_all_background_tasks().await?;

    // Then start tasks based on current configuration
    start_background_tasks_from_config(app_handle).await
}

/// Initialize background task management system
#[tauri::command]
pub fn init_background_task_manager(app_handle: AppHandle) {
    // Start initial background tasks
    tauri::async_runtime::spawn(async move {
        if let Err(e) = manage_background_tasks(app_handle).await {
            tracing::error!("Failed to start initial background tasks: {}", e);
        }
    });
}

/// Get status of background tasks
#[tauri::command]
pub async fn get_background_tasks_status() -> Result<serde_json::Value, String> {
    let intention_running = INTENTION_TASK_HANDLE.lock().unwrap().is_some();
    let screenshots_running = SCREENSHOT_TASK_HANDLE.lock().unwrap().is_some();

    let config = sql::get_config().map_err(|e| format!("Failed to get config: {}", e))?;
    let enabled = config.enable_background_tasks == "true";
    let screenshot_delay = parse_delay(&config.screenshot_delay, 10);
    let intention_delay = parse_delay(&config.user_intention_delay, 15) * 60;

    Ok(serde_json::json!({
        "enabled": enabled,
        "intention_analysis_running": intention_running,
        "screenshots_running": screenshots_running,
        "screenshot_delay_minutes": screenshot_delay,
        "intention_delay_minutes": intention_delay
    }))
}
