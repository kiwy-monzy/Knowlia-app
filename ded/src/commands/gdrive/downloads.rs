use super::GDriveItem;
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

/// Scan Downloads folder and create folder structure with recorded download metadata
pub async fn scan_downloads_with_metadata() -> Result<Vec<super::GDriveItem>, String> {
    use super::download::get_recorded_downloads;

    let downloads_dir = get_downloads_dir().map_err(|e| e.to_string())?;

    let mut items = scan_directory(&downloads_dir).map_err(|e| e.to_string())?;

    // Get recorded downloads to enhance metadata
    if let Ok(recorded_downloads) = get_recorded_downloads() {
        items = items
            .into_iter()
            .map(|mut item| {
                // Find matching record
                if let Some(record) = recorded_downloads.iter().find(|r| r.file_name == item.name) {
                    item.data_id = Some(record.file_id.clone()); // Use original file ID
                }
                item
            })
            .collect();
    }

    Ok(items)
}

/// Scan Downloads folder and create folder structure
#[tauri::command]
pub async fn scan_downloads_folder() -> Result<Vec<GDriveItem>, String> {
    let downloads_dir = get_downloads_dir().map_err(|e| e.to_string())?;

    let items = scan_directory(&downloads_dir).map_err(|e| e.to_string())?;

    Ok(items)
}

/// Get the Downloads directory (Documents/KNOWLIA#NOTES)
fn get_downloads_dir() -> Result<PathBuf> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find Documents directory"))?;

    let downloads_dir = documents_dir.join("KNOWLIA#NOTES");

    if !downloads_dir.exists() {
        fs::create_dir_all(&downloads_dir).with_context(|| {
            format!("Failed to create downloads directory: {:?}", downloads_dir)
        })?;
    }

    Ok(downloads_dir)
}

/// Scan directory and create GDriveItem structure
fn scan_directory(dir: &PathBuf) -> Result<Vec<GDriveItem>> {
    let mut items = Vec::new();

    if !dir.exists() {
        return Ok(items);
    }

    let entries =
        fs::read_dir(dir).with_context(|| format!("Failed to read directory: {:?}", dir))?;

    for entry in entries {
        let entry = entry.with_context(|| "Failed to read directory entry")?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .with_context(|| "Failed to get file metadata")?;

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let is_folder = metadata.is_dir();
        let size = if !is_folder {
            Some(format_bytes(metadata.len()))
        } else {
            None
        };

        let file_type = if !is_folder {
            get_file_extension(&name)
        } else {
            None
        };

        let children = if is_folder {
            match scan_directory(&path) {
                Ok(child_items) if !child_items.is_empty() => Some(child_items),
                _ => None,
            }
        } else {
            None
        };

        let item = GDriveItem {
            name,
            data_id: Some(path.to_string_lossy().to_string()), // Use full path as ID
            is_folder,
            size,
            file_type,
            url: None, // No URL for local files
            parent_id: path
                .parent()
                .and_then(|p| p.to_str())
                .map(|s| s.to_string()),
            children,
        };

        items.push(item);
    }

    // Sort: folders first, then files, both alphabetically
    items.sort_by(|a, b| match (a.is_folder, b.is_folder) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(items)
}

/// Get file extension from filename
fn get_file_extension(filename: &str) -> Option<String> {
    std::path::Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
}

/// Format bytes to human readable format
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}
