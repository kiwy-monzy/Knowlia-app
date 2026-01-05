use base64::{engine::general_purpose, Engine as _};
use flate2::write::{GzDecoder, GzEncoder};
use flate2::Compression;
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageFormat, Rgba};
use image_compare::Algorithm;
use std::fs;
use std::io::prelude::*;
use std::io::Cursor;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

/// Converts an image to a data URL with automatic resizing and JPEG compression.
pub fn image_to_url(image: ImageBuffer<Rgba<u8>, Vec<u8>>) -> Result<String, String> {
    const MAX_WIDTH: u32 = 1920;
    const MAX_HEIGHT: u32 = 1080;

    // Convert RgbaImage to DynamicImage
    let mut img = DynamicImage::ImageRgba8(image.clone());

    // Resize the image if it's too large, preserving aspect ratio
    let (width, height) = img.dimensions();
    if width > MAX_WIDTH || height > MAX_HEIGHT {
        img = img.thumbnail(MAX_WIDTH, MAX_HEIGHT);
    }

    // Encode the image as JPEG
    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);

    img.write_to(&mut cursor, ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

    // Convert to base64 and create data URL
    let base64_image = general_purpose::STANDARD.encode(&buffer);
    let data_url = format!("data:image/jpeg;base64,{}", base64_image);

    Ok(data_url)
}

/// Converts an image file path to a data URL with automatic resizing and JPEG compression.
pub fn image_path_to_image_buffer(
    image_path: &str,
) -> Result<ImageBuffer<Rgba<u8>, Vec<u8>>, String> {
    // Read the image file
    let image_data = fs::read(image_path)
        .map_err(|e| format!("Failed to read image file '{}': {}", image_path, e))?;

    // Load the image from bytes
    let img = image::load_from_memory(&image_data)
        .map_err(|e| format!("Failed to load image from file '{}': {}", image_path, e))?;

    // Convert to RGBA format
    Ok(img.to_rgba8())
}

/// Converts an image file path to a data URL with automatic resizing and JPEG compression.
pub fn image_path_to_url(image_path: &str) -> Result<String, String> {
    let rgba_image = image_path_to_image_buffer(image_path)?;

    // Use the existing image_to_url function to process and convert
    image_to_url(rgba_image)
}

/// Parses a data URI and loads it into a DynamicImage.
pub fn load_image_from_data_url(data_url: &str) -> Result<image::DynamicImage, String> {
    let base64_data = data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "Invalid data URL: missing comma".to_string())?;

    let image_bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to load image from memory: {}", e))
}

pub fn image_similarity(data_url1: &str, data_url2: &str) -> Result<f64, String> {
    let img1 = load_image_from_data_url(data_url1)?;
    let img2 = load_image_from_data_url(data_url2)?;

    // Compare the two images using the Root Mean Square (RMS) algorithm.
    let comparison_result = image_compare::rgb_similarity_structure(
        &Algorithm::RootMeanSquared,
        &img1.into_rgb8(),
        &img2.into_rgb8(),
    );

    match comparison_result {
        Ok(similarity) => Ok(similarity.score),
        Err(e) => Err(format!("Failed to compare images: {}", e)),
    }
}

/// Extracts the content of an XML tag from a string.
/// Returns the content between the opening and closing tags, or None if not found.
pub fn extract_xml_tag_content(xml_string: &str, tag_name: &str) -> Option<String> {
    let opening_tag = format!("<{}>", tag_name);
    let closing_tag = format!("</{}>", tag_name);

    let start_pos = xml_string.to_lowercase().find(&opening_tag)?;
    let content_start = start_pos + opening_tag.len();

    let content_slice = &xml_string[content_start..];
    let end_pos = content_slice.to_lowercase().find(&closing_tag)?;

    Some(content_slice[..end_pos].trim().to_string())
}

/// Compresses a string using gzip compression
pub fn compress_string(data: &str) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to compressor: {}", e))?;
    encoder
        .finish()
        .map_err(|e| format!("Failed to compress data: {}", e))
}

/// Decompresses a gzip-compressed byte array back to a string
pub fn decompress_string(compressed_data: &[u8]) -> Result<String, String> {
    let mut decoder = GzDecoder::new(Vec::new());
    decoder
        .write_all(compressed_data)
        .map_err(|e| format!("Failed to write to decompressor: {}", e))?;
    let decompressed = decoder
        .finish()
        .map_err(|e| format!("Failed to decompress data: {}", e))?;
    String::from_utf8(decompressed)
        .map_err(|e| format!("Failed to convert decompressed data to string: {}", e))
}

/// Normalizes a category string by finding the first matching label from the provided list.
/// If no match is found, returns "other" as the default.
pub fn normalize_category(category_str: &str, valid_labels: &[&str]) -> String {
    let category_lower = category_str.to_lowercase();

    // Look for the first valid label that appears in the category string
    for label in valid_labels {
        if category_lower.contains(label) {
            return label.to_string();
        }
    }

    // If no match found, return "other" as default
    "other".to_string()
}

pub fn resolve_resource(app_handle: &AppHandle, filename: &str) -> Result<String, String> {
    app_handle
        .path()
        .resolve(filename, BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource: {}", e))
        .map(|p| p.to_string_lossy().to_string())
}

pub fn emit_error(app_handle: &AppHandle, error: &str) -> Result<(), String> {
    app_handle
        .emit("error", error)
        .map_err(|e| format!("Failed to emit notification: {}", e))?;
    Ok(())
}
