pub mod service;

use service::{EmbeddingManager, EmbeddingRequest, EmbeddingServiceInfo};
use tauri::{AppHandle, Manager};

async fn _create_embedding(
    manager: &EmbeddingManager,
    text: String,
    normalize: Option<bool>,
) -> Result<Vec<f32>, String> {
    let request = EmbeddingRequest { text, normalize };
    let response = manager
        .create_embedding(request)
        .await
        .map_err(|e| format!("Failed to create embedding: {}", e))?;
    Ok(response.embeddings)
}

/// INTERNAL: A helper for calling the embedding logic directly from the backend.
pub async fn create_embedding_internal(
    app_handle: &AppHandle,
    text: String,
    normalize: bool,
) -> Result<Vec<f32>, String> {
    let manager = app_handle.state::<EmbeddingManager>();
    _create_embedding(&manager, text, Some(normalize)).await
}

#[tauri::command]
pub async fn init_embedding_service(
    app_handle: AppHandle,
    manager: tauri::State<'_, EmbeddingManager>,
) -> Result<(), String> {
    manager
        .initialize(app_handle)
        .await
        .map_err(|e| format!("Failed to initialize embedding service: {}", e))
}

#[tauri::command]
pub async fn embedding_service_info(
    manager: tauri::State<'_, EmbeddingManager>,
) -> Result<EmbeddingServiceInfo, String> {
    manager
        .get_model_info()
        .await
        .map_err(|e| format!("Failed to initialize embedding service: {}", e))
}

#[tauri::command]
pub async fn create_embedding(
    text: String,
    normalize: Option<bool>,
    manager: tauri::State<'_, EmbeddingManager>,
) -> Result<Vec<f32>, String> {
    // Now just a thin wrapper around the core logic
    _create_embedding(&manager, text, normalize).await
}

#[tauri::command]
pub async fn compute_text_similarity(
    text1: String,
    text2: String,
    manager: tauri::State<'_, EmbeddingManager>,
) -> Result<f32, String> {
    manager
        .compute_similarity(text1, text2)
        .await
        .map_err(|e| format!("Failed to compute similarity: {}", e))
}

#[tauri::command]
pub async fn compute_embedding_similarity(
    embedding1: Vec<f32>,
    embedding2: Vec<f32>,
    manager: tauri::State<'_, EmbeddingManager>,
) -> Result<f32, String> {
    manager
        .compute_similarity_embeddings(embedding1, embedding2)
        .await
        .map_err(|e| format!("Failed to compute similarity: {}", e))
}
