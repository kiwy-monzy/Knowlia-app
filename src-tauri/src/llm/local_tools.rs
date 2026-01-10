use crate::{
    constants::MAX_ROWS,
    embedding::create_embedding_internal,
    ocr,
    sql::{
        self,
        model::{UserIntentionHistory, WindowInfoData},
    },
};
use std::collections::HashMap;
use tauri::AppHandle;

#[allow(dead_code)]
pub async fn semantic_search_user_intention(
    app_handle: &AppHandle,
    query: &str,
    hours_ago: u32,
) -> Result<Vec<UserIntentionHistory>, String> {
    match create_embedding_internal(app_handle, query.to_string(), true).await {
        Ok(query_embedding) => {
            sql::queries::search_user_intentions(query_embedding, MAX_ROWS, hours_ago)
                .map_err(|err| format!("Error searching user intentions: {}", err))
        }
        Err(err) => {
            tracing::error!(
                "Error creating embedding for user intention search: {}",
                err
            );
            Err(err.to_string())
        }
    }
}

pub async fn semantic_search_screenshots(
    app_handle: &AppHandle,
    query: &str,
    hours_ago: u32,
) -> Result<HashMap<String, Vec<WindowInfoData>>, String> {
    match create_embedding_internal(app_handle, query.to_string(), true).await {
        Ok(query_embedding) => {
            sql::queries::search_window_info_by_process_name(query_embedding, MAX_ROWS, hours_ago)
                .map_err(|err| format!("Error searching window info: {}", err))
        }

        Err(err) => {
            tracing::error!("Error creating embedding for window info search: {}", err);
            Err(err.to_string())
        }
    }
}

pub async fn get_ocr(app_handle: &AppHandle, screenshot_id: u32) -> Result<String, String> {
    match sql::queries::get_screenshot_url(screenshot_id) {
        Ok(screenshot_url) => {
            if screenshot_url.is_empty() {
                return Ok(String::new());
            }
            if let Ok(ocr_response) =
                ocr::process_image_from_url(app_handle.clone(), screenshot_url).await
            {
                Ok(ocr_response.lines.join("\n"))
            } else {
                Err("Error processing image".to_string())
            }
        }
        Err(err) => Err(format!("Error getting screenshot URL: {}", err)),
    }
}

#[tauri_crate::command]
pub async fn semantic_search_window_info(
    app_handle: AppHandle,
    query: &str,
    hours_ago: u32,
) -> Result<Vec<WindowInfoData>, String> {
    match create_embedding_internal(&app_handle, query.to_string(), true).await {
        Ok(query_embedding) => {
            sql::queries::search_window_info(query_embedding, MAX_ROWS, hours_ago)
                .map_err(|err| format!("Error searching user intentions: {}", err))
        }
        Err(err) => {
            tracing::error!(
                "Error creating embedding for user intention search: {}",
                err
            );
            Err(err.to_string())
        }
    }
}
