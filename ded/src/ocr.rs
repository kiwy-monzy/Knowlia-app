use screenshots::Screen;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::timeout;

use ocrs::{ImageSource, OcrEngine, OcrEngineParams};
use rten::Model;
#[allow(unused)]
use rten_tensor::prelude::*;
use tauri::{AppHandle, Manager};

use crate::helpers;
use crate::window_manager;

#[derive(Debug, Clone)]
pub struct OcrRequest {
    pub image_data: Vec<u8>,
    pub image_dimensions: (u32, u32),
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OcrResponse {
    pub lines: Vec<String>,
}

pub struct OcrService {
    engine: Option<OcrEngine>,
    is_ready: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct OcrServiceInfo {
    pub is_ready: bool,
    pub models_loaded: bool,
}

impl OcrService {
    pub fn new() -> Self {
        Self {
            engine: None,
            is_ready: false,
        }
    }

    pub async fn initialize(&mut self, app_handle: &AppHandle) -> Result<(), Box<dyn Error>> {
        // Use the `download-models.sh` script to download the models.
        let detection_model_path =
            helpers::resolve_resource(app_handle, "assets/ocr/text-detection.rten")?;
        let rec_model_path =
            helpers::resolve_resource(app_handle, "assets/ocr/text-recognition.rten")?;

        let detection_model = Model::load_file(detection_model_path)?;
        let recognition_model = Model::load_file(rec_model_path)?;

        let engine = OcrEngine::new(OcrEngineParams {
            detection_model: Some(detection_model),
            recognition_model: Some(recognition_model),
            ..Default::default()
        })?;

        self.engine = Some(engine);
        self.is_ready = true;

        Ok(())
    }

    pub async fn process_image(&self, request: OcrRequest) -> Result<OcrResponse, Box<dyn Error>> {
        if !self.is_ready {
            return Err("OCR service not initialized".into());
        }

        let engine = self.engine.as_ref().ok_or("OCR engine not available")?;

        // Apply standard image pre-processing expected by this library (convert
        // to greyscale, map range to [-0.5, 0.5]).
        let img_source = ImageSource::from_bytes(&request.image_data, request.image_dimensions)?;
        let ocr_input = engine.prepare_input(img_source)?;

        // Get oriented bounding boxes of text words in input image.
        let word_rects = engine.detect_words(&ocr_input)?;

        // Group words into lines. Each line is represented by a list of word
        // bounding boxes.
        let line_rects = engine.find_text_lines(&ocr_input, &word_rects);

        // Recognize the characters in each line.
        let line_texts = engine.recognize_text(&ocr_input, &line_rects)?;

        let lines: Vec<String> = line_texts
            .iter()
            .flatten()
            // Filter likely spurious detections. With future model improvements
            // this should become unnecessary.
            .filter(|l| l.to_string().len() > 3)
            .map(|l| l.to_string())
            .collect();

        Ok(OcrResponse { lines })
    }

    pub async fn process_image_from_url(
        &self,
        image_url: &str,
    ) -> Result<OcrResponse, Box<dyn Error>> {
        let process_future = async {
            let img = helpers::load_image_from_data_url(image_url)?;

            let rgba_img = img.to_rgba8();
            let request = OcrRequest {
                image_data: rgba_img.as_raw().to_vec(),
                image_dimensions: rgba_img.dimensions(),
            };

            self.process_image(request).await
        };

        match timeout(Duration::from_secs(15), process_future).await {
            Ok(result) => result,
            Err(_) => Err("OCR processing timed out after 15 seconds".into()),
        }
    }

    pub fn get_service_info(&self) -> OcrServiceInfo {
        OcrServiceInfo {
            is_ready: self.is_ready,
            models_loaded: self.engine.is_some(),
        }
    }
}

pub struct OcrManager {
    service: Arc<RwLock<OcrService>>,
}

impl OcrManager {
    pub fn new() -> Self {
        Self {
            service: Arc::new(RwLock::new(OcrService::new())),
        }
    }

    pub async fn initialize(&self, app_handle: &AppHandle) -> Result<(), String> {
        let mut service = self.service.write().await;
        service
            .initialize(app_handle)
            .await
            .map_err(|e| format!("Failed to initialize OCR service: {}", e))
    }

    pub async fn get_service_info(&self) -> OcrServiceInfo {
        let service = self.service.read().await;
        service.get_service_info()
    }

    pub async fn process_image_from_url(&self, image_url: &str) -> Result<OcrResponse, String> {
        let process_future = async {
            let service = self.service.read().await;
            service
                .process_image_from_url(image_url)
                .await
                .map_err(|e| format!("OCR processing failed: {}", e))
        };

        match timeout(Duration::from_secs(15), process_future).await {
            Ok(result) => result,
            Err(_) => Err("OCR processing timed out after 15 seconds".to_string()),
        }
    }
}

// Tauri Commands
#[tauri_crate::command]
pub async fn init_ocr_service(app_handle: AppHandle) -> Result<(), String> {
    let ocr_manager = app_handle.state::<OcrManager>();
    ocr_manager.initialize(&app_handle).await?;
    Ok(())
}

#[tauri_crate::command]
pub async fn ocr_service_info(app_handle: AppHandle) -> Result<OcrServiceInfo, String> {
    let ocr_manager = app_handle.state::<OcrManager>();
    Ok(ocr_manager.get_service_info().await)
}

#[tauri_crate::command]
pub async fn process_image_from_url(
    app_handle: AppHandle,
    image_url: String,
) -> Result<OcrResponse, String> {
    let ocr_manager = app_handle.state::<OcrManager>();
    ocr_manager.process_image_from_url(&image_url).await
}

#[tauri_crate::command]
pub async fn take_screenshot_and_process(app_handle: AppHandle) -> Result<OcrResponse, String> {
    let ocr_manager = app_handle.state::<OcrManager>();

    #[cfg(target_os = "linux")]
    let _guard = window_manager::linux::ScreenshotGuard::new()
        .map_err(|e| format!("Failed to activate screenshot guard: {}", e))?;

    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    let raw_image = window_manager::capture_active_window()
        .map_err(|e| format!("Failed to capture active window: {}", e))?;

    let image_url = helpers::image_to_url(raw_image)?;
    ocr_manager.process_image_from_url(&image_url).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ocr_service_creation() {
        let service = OcrService::new();
        assert!(!service.is_ready);
        assert!(service.engine.is_none());
    }

    #[tokio::test]
    async fn test_ocr_manager_creation() {
        let manager = OcrManager::new();
        let info = manager.get_service_info().await;
        assert!(!info.is_ready);
        assert!(!info.models_loaded);
    }
}
