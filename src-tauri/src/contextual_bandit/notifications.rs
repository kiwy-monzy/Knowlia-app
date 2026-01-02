use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::{
    constants,
    contextual_bandit::{context::UserAction, manager},
    llm::suggestions::call_model_for_suggestions,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub id: String,
    pub from_test: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationResponse {
    pub id: String,
    pub action: String, // "accept", "reject", "omit"
    pub timestamp: i64,
    pub from_test: bool,
}

/// Send a notification with a generated UUID
#[tauri::command]
pub async fn send_notification(app_handle: AppHandle, from_test: bool) -> Result<String, String> {
    // Generate a unique UUID for this notification
    let notification_uuid = Uuid::new_v4().to_string();

    let payload = NotificationPayload {
        id: notification_uuid.clone(),
        from_test,
    };

    app_handle
        .emit("notification", &payload)
        .map_err(|e| format!("Failed to emit notification: {}", e))?;

    tracing::info!("Sent notification with UUID: {}", notification_uuid);

    Ok(notification_uuid)
}

/// Handle user response to notification
#[tauri::command]
pub async fn handle_notification_response(
    app_handle: AppHandle,
    response: NotificationResponse,
) -> Result<(), String> {
    tracing::info!(
        "Received notification response: {} - {} at {}",
        response.id,
        response.action,
        response.timestamp
    );

    match manager::get_latest_bandit_context() {
        Some(context) => {
            if !response.from_test {
                match response.action.as_str() {
                    "accept" => manager::train_bandit_agent(&context, 1, UserAction::Accept)?,
                    "reject" => manager::train_bandit_agent(&context, 1, UserAction::Reject)?,
                    "omit" => manager::train_bandit_agent(&context, 1, UserAction::Omit)?,
                    _ => (),
                };
            }
            call_model_for_suggestions(
                app_handle,
                context,
                Some(constants::WINDOW_TIME_MINUTES as i64),
            )
            .await?;
            manager::drop_latest_bandit_context();
        }
        None => (),
    };

    Ok(())
}
