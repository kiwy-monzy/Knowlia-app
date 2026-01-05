use ::tauri::{command, State};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::tauri::zotero::{ZoteroManager, ZoteroConfig, ZoteroItem, ZoteroCollection};
use std::path::PathBuf;

/// Global state for Zotero manager
pub struct ZoteroState {
    pub manager: Arc<Mutex<Option<ZoteroManager>>>,
}

impl ZoteroState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(None)),
        }
    }
}

/// Initialize Zotero manager
#[command]
pub async fn init_zotero(state: State<'_, ZoteroState>) -> Result<bool, String> {
    let mut manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    
    if manager_guard.is_some() {
        return Ok(true);
    }
    
    // Get app data directory
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("tauri-app")
        .join("zotero");
    
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    
    // Initialize Zotero manager
    let manager: ZoteroManager = ZoteroManager::new(app_data_dir)
        .await
        .map_err(|e| format!("Failed to initialize Zotero manager: {}", e))?;
    
    // Try to load existing configuration
    let has_config = manager.load_config().await
        .map_err(|e| format!("Failed to load configuration: {}", e))?;
    
    *manager_guard = Some(manager);
    
    Ok(has_config)
}

/// Configure Zotero with API credentials
#[command]
pub async fn configure_zotero(
    state: State<'_, ZoteroState>,
    library_type: String,
    id: String,
    api_key: String,
) -> Result<(), String> {
    let mut manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_mut()
        .ok_or("Zotero manager not initialized")?;
    
    let config = match library_type.as_str() {
        "user" => ZoteroConfig::new_user(id, api_key),
        "group" => ZoteroConfig::new_group(id, api_key),
        _ => return Err("Invalid library type. Use 'user' or 'group'".to_string()),
    };
    
    manager.configure(config).await
        .map_err(|e| format!("Failed to configure Zotero: {}", e))?;
    
    Ok(())
}

/// Get current Zotero configuration
#[command]
pub async fn get_zotero_config(state: State<'_, ZoteroState>) -> Result<ZoteroConfig, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let config = manager.get_config().await;
    Ok(config)
}

/// Check if Zotero is configured
#[command]
pub async fn is_zotero_configured(state: State<'_, ZoteroState>) -> Result<bool, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let configured = manager.is_configured().await;
    Ok(configured)
}

/// Get all Zotero items
#[command]
pub async fn get_zotero_items(state: State<'_, ZoteroState>) -> Result<Vec<ZoteroItem>, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let items: Vec<ZoteroItem> = manager.get_items().await
        .map_err(|e| format!("Failed to get items: {}", e))?;
    
    Ok(items)
}

/// Get items from a specific collection
#[command]
pub async fn get_collection_items(
    state: State<'_, ZoteroState>,
    collection_key: String,
) -> Result<Vec<ZoteroItem>, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let items: Vec<ZoteroItem> = manager.get_collection_items(&collection_key).await
        .map_err(|e| format!("Failed to get collection items: {}", e))?;
    
    Ok(items)
}

/// Get all Zotero collections
#[command]
pub async fn get_zotero_collections(state: State<'_, ZoteroState>) -> Result<Vec<ZoteroCollection>, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let collections: Vec<ZoteroCollection> = manager.get_collections().await
        .map_err(|e| format!("Failed to get collections: {}", e))?;
    
    Ok(collections)
}

/// Search Zotero items
#[command]
pub async fn search_zotero_items(
    state: State<'_, ZoteroState>,
    query: String,
) -> Result<Vec<ZoteroItem>, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let items: Vec<ZoteroItem> = manager.search_items(&query).await
        .map_err(|e| format!("Failed to search items: {}", e))?;
    
    Ok(items)
}

/// Create a new Zotero item
#[command]
pub async fn create_zotero_item(
    state: State<'_, ZoteroState>,
    item: ZoteroItem,
) -> Result<ZoteroItem, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let created_item: ZoteroItem = manager.create_item(&item).await
        .map_err(|e| format!("Failed to create item: {}", e))?;
    
    Ok(created_item)
}

/// Update an existing Zotero item
#[command]
pub async fn update_zotero_item(
    state: State<'_, ZoteroState>,
    item: ZoteroItem,
) -> Result<ZoteroItem, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let updated_item: ZoteroItem = manager.update_item(&item).await
        .map_err(|e| format!("Failed to update item: {}", e))?;
    
    Ok(updated_item)
}

/// Delete a Zotero item
#[command]
pub async fn delete_zotero_item(
    state: State<'_, ZoteroState>,
    item_key: String,
) -> Result<(), String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    manager.delete_item(&item_key).await
        .map_err(|e| format!("Failed to delete item: {}", e))?;
    
    Ok(())
}

/// Create a new Zotero collection
#[command]
pub async fn create_zotero_collection(
    state: State<'_, ZoteroState>,
    collection: ZoteroCollection,
) -> Result<ZoteroCollection, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let created_collection: ZoteroCollection = manager.create_collection(&collection.name, collection.parent_collection.as_deref()).await
        .map_err(|e| format!("Failed to create collection: {}", e))?;
    
    Ok(created_collection)
}

/// Update an existing Zotero collection
#[command]
pub async fn update_zotero_collection(
    state: State<'_, ZoteroState>,
    collection: ZoteroCollection,
) -> Result<ZoteroCollection, String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let updated_collection: ZoteroCollection = manager.update_collection(&collection).await
        .map_err(|e| format!("Failed to update collection: {}", e))?;
    
    Ok(updated_collection)
}

/// Delete a Zotero collection
#[command]
pub async fn delete_zotero_collection(
    state: State<'_, ZoteroState>,
    collection_key: String,
) -> Result<(), String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    manager.delete_collection(&collection_key).await
        .map_err(|e| format!("Failed to delete collection: {}", e))?;
    
    Ok(())
}

/// Clear all cached data
#[command]
pub async fn clear_zotero_cache(state: State<'_, ZoteroState>) -> Result<(), String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    manager.clear_cache().await
        .map_err(|e| format!("Failed to clear cache: {}", e))?;
    
    Ok(())
}

/// Get database statistics
#[command]
pub async fn get_zotero_stats(state: State<'_, ZoteroState>) -> Result<(usize, usize), String> {
    let manager_guard: tokio::sync::MutexGuard<Option<ZoteroManager>> = state.manager.lock().await;
    let manager = manager_guard.as_ref()
        .ok_or("Zotero manager not initialized")?;
    
    let stats: (usize, usize) = manager.get_stats().await
        .map_err(|e| format!("Failed to get stats: {}", e))?;
    
    Ok(stats)
}
