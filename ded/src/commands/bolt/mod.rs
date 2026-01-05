use crate::taxi_service::bolt::{
    confirm_verification as bolt_confirm_verification,
    get_location_suggestions as bolt_get_location_suggestions,
    start_verification as bolt_start_verification,
};

#[tauri::command]
pub async fn start_verification(
    phone_number: String,
    uuid: String,
) -> Result<serde_json::Value, String> {
    bolt_start_verification(phone_number, uuid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn confirm_verification(
    phone_number: String,
    uuid: String,
    code: String,
) -> Result<serde_json::Value, String> {
    bolt_confirm_verification(phone_number, uuid, code)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_location_suggestions(search_string: String) -> Result<String, String> {
    bolt_get_location_suggestions(search_string)
        .await
        .map_err(|e| e.to_string())
}
