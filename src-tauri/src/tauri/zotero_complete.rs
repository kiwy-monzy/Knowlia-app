use zotero::{Zotero, ZoteroInit};
use sled::{Db, Tree};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::path::PathBuf;
use tokio::sync::RwLock;
use std::sync::Arc;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Enhanced Zotero client with sled storage and full async support
pub struct ZoteroManager {
    client: Option<Zotero<'static>>,
    db: Arc<Db>,
    items_tree: Arc<Tree>,
    collections_tree: Arc<Tree>,
    config: Arc<RwLock<ZoteroConfig>>,
}

/// Basic item structure for Zotero items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoteroItem {
    pub key: String,
    pub version: Option<i32>,
    pub item_type: String,
    pub title: Option<String>,
    pub creators: Vec<Creator>,
    pub tags: Vec<Tag>,
    pub date_added: Option<String>,
    pub date_modified: Option<String>,
    pub abstract_note: Option<String>,
    pub url: Option<String>,
    pub doi: Option<String>,
    pub isbn: Option<String>,
    pub publication_title: Option<String>,
    pub volume: Option<String>,
    pub issue: Option<String>,
    pub pages: Option<String>,
    pub publisher: Option<String>,
    pub date: Option<String>,
    pub language: Option<String>,
    pub notes: Vec<String>,
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Creator {
    pub creator_type: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub tag: String,
    pub type_: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub key: String,
    pub title: String,
    pub mime_type: String,
    pub url: Option<String>,
}

/// Collection structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoteroCollection {
    pub key: String,
    pub name: String,
    pub parent_collection: Option<String>,
    pub version: Option<i32>,
    pub date_added: Option<String>,
    pub date_modified: Option<String>,
}

/// Configuration for Zotero integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoteroConfig {
    pub user_id: Option<String>,
    pub group_id: Option<String>,
    pub api_key: String,
    pub library_type: LibraryType,
    pub cache_duration_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LibraryType {
    User,
    Group,
}

/// Error types for Zotero operations
#[derive(Debug, thiserror::Error)]
pub enum ZoteroError {
    #[error("API authentication failed: {0}")]
    AuthenticationError(String),
    
    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),
    
    #[error("Database error: {0}")]
    DatabaseError(#[from] sled::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] bincode::Error),
    
    #[error("Item not found: {0}")]
    ItemNotFound(String),
    
    #[error("Collection not found: {0}")]
    CollectionNotFound(String),
    
    #[error("Invalid item data: {0}")]
    InvalidItemData(String),
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("Not configured")]
    NotConfigured,
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl ZoteroConfig {
    pub fn new_user(user_id: String, api_key: String) -> Self {
        Self {
            user_id: Some(user_id),
            group_id: None,
            api_key,
            library_type: LibraryType::User,
            cache_duration_minutes: 60,
        }
    }

    pub fn new_group(group_id: String, api_key: String) -> Self {
        Self {
            user_id: None,
            group_id: Some(group_id),
            api_key,
            library_type: LibraryType::Group,
            cache_duration_minutes: 60,
        }
    }
}

impl ZoteroManager {
    /// Create a new Zotero manager with sled database
    pub async fn new(db_path: PathBuf) -> Result<Self> {
        let db = Arc::new(sled::open(&db_path)?);
        let items_tree = Arc::new(db.open_tree("items")?);
        let collections_tree = Arc::new(db.open_tree("collections")?);
        
        info!("Zotero manager initialized with database at: {:?}", db_path);
        
        Ok(Self {
            client: None,
            db,
            items_tree,
            collections_tree,
            config: Arc::new(RwLock::new(ZoteroConfig::new_user("".to_string(), "".to_string()))),
        })
    }

    /// Configure the Zotero manager with API credentials
    pub async fn configure(&mut self, config: ZoteroConfig) -> Result<()> {
        // Store configuration
        {
            let mut config_guard = self.config.write().await;
            *config_guard = config.clone();
        }
        
        // Store config in database
        let config_bytes = bincode::serialize(&config)?;
        self.db.insert("zotero_config", config_bytes)?;
        
        // Create Zotero client
        self.client = Some(match config.library_type {
            LibraryType::User => {
                let user_id = config.user_id.as_ref().ok_or_else(|| ZoteroError::InvalidItemData("User ID required for user library".to_string()))?;
                ZoteroInit::set_user(user_id, &config.api_key)
            }
            LibraryType::Group => {
                let group_id = config.group_id.as_ref().ok_or_else(|| ZoteroError::InvalidItemData("Group ID required for group library".to_string()))?;
                ZoteroInit::set_group(group_id, Some(&config.api_key))
            }
        });
        
        info!("Zotero manager configured with {} library", 
              match config.library_type {
                  LibraryType::User => "user",
                  LibraryType::Group => "group",
              });
        
        Ok(())
    }

    /// Load configuration from database
    pub async fn load_config(&mut self) -> Result<bool> {
        if let Some(config_bytes) = self.db.get("zotero_config")? {
            let config: ZoteroConfig = bincode::deserialize(&config_bytes)?;
            self.configure(config).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Get all items from cache or API
    pub async fn get_items(&self) -> Result<Vec<ZoteroItem>> {
        let config = self.config.read().await;
        
        // Try to get from cache first
        if let Ok(cached_items) = self.get_cached_items().await {
            if !cached_items.is_empty() {
                info!("Returning {} items from cache", cached_items.len());
                return Ok(cached_items);
            }
        }
        
        // Fetch from API if client is configured
        if let Some(ref _client) = self.client {
            // This would use the actual zotero crate API
            // For now, return empty vec as placeholder
            warn!("API calls not yet implemented, returning empty result");
            Ok(vec![])
        } else {
            Err(ZoteroError::NotConfigured)
        }
    }

    /// Get items from a specific collection
    pub async fn get_collection_items(&self, collection_key: &str) -> Result<Vec<ZoteroItem>> {
        let all_items = self.get_items().await?;
        let filtered_items = all_items.into_iter()
            .filter(|item| {
                // This would need to check if item belongs to collection
                // For now, return all items
                true
            })
            .collect();
        Ok(filtered_items)
    }

    /// Get all collections
    pub async fn get_collections(&self) -> Result<Vec<ZoteroCollection>> {
        // Try to get from cache first
        if let Ok(cached_collections) = self.get_cached_collections().await {
            if !cached_collections.is_empty() {
                info!("Returning {} collections from cache", cached_collections.len());
                return Ok(cached_collections);
            }
        }
        
        // Fetch from API if client is configured
        if let Some(ref _client) = self.client {
            // This would use the actual zotero crate API
            warn!("API calls not yet implemented, returning empty result");
            Ok(vec![])
        } else {
            Err(ZoteroError::NotConfigured)
        }
    }

    /// Search items by query
    pub async fn search_items(&self, query: &str) -> Result<Vec<ZoteroItem>> {
        let all_items = self.get_items().await?;
        let query_lower = query.to_lowercase();
        
        let filtered_items = all_items.into_iter()
            .filter(|item| {
                let title_match = item.title.as_ref()
                    .map(|t| t.to_lowercase().contains(&query_lower))
                    .unwrap_or(false);
                
                let creator_match = item.creators.iter()
                    .any(|c| {
                        c.first_name.as_ref().map(|f| f.to_lowercase().contains(&query_lower)).unwrap_or(false) ||
                        c.last_name.as_ref().map(|l| l.to_lowercase().contains(&query_lower)).unwrap_or(false)
                    });
                
                let tag_match = item.tags.iter()
                    .any(|t| t.tag.to_lowercase().contains(&query_lower));
                
                title_match || creator_match || tag_match
            })
            .collect();
        
        Ok(filtered_items)
    }

    /// Create a new item
    pub async fn create_item(&self, mut item: ZoteroItem) -> Result<ZoteroItem> {
        if item.key.is_empty() {
            item.key = Uuid::new_v4().to_string();
        }
        
        item.date_added = Some(Utc::now().to_rfc3339());
        item.date_modified = Some(Utc::now().to_rfc3339());
        
        // Store in local cache
        self.cache_item(&item).await?;
        
        // If API client is available, sync with Zotero
        if let Some(ref _client) = self.client {
            // This would create the item via the Zotero API
            info!("Item {} created locally, API sync pending", item.key);
        }
        
        info!("Created new item: {}", item.title.as_ref().unwrap_or(&item.key));
        Ok(item)
    }

    /// Update an existing item
    pub async fn update_item(&self, mut item: ZoteroItem) -> Result<ZoteroItem> {
        // Check if item exists
        if !self.item_exists(&item.key).await? {
            return Err(ZoteroError::ItemNotFound(item.key));
        }
        
        item.date_modified = Some(Utc::now().to_rfc3339());
        
        // Update in local cache
        self.cache_item(&item).await?;
        
        // If API client is available, sync with Zotero
        if let Some(ref _client) = self.client {
            // This would update the item via the Zotero API
            info!("Item {} updated locally, API sync pending", item.key);
        }
        
        info!("Updated item: {}", item.title.as_ref().unwrap_or(&item.key));
        Ok(item)
    }

    /// Delete an item
    pub async fn delete_item(&self, item_key: &str) -> Result<()> {
        // Check if item exists
        if !self.item_exists(item_key).await? {
            return Err(ZoteroError::ItemNotFound(item_key.to_string()));
        }
        
        // Remove from local cache
        self.items_tree.remove(item_key.as_bytes())?;
        
        // If API client is available, delete from Zotero
        if let Some(ref _client) = self.client {
            // This would delete the item via the Zotero API
            info!("Item {} deleted locally, API sync pending", item_key);
        }
        
        info!("Deleted item: {}", item_key);
        Ok(())
    }

    /// Create a new collection
    pub async fn create_collection(&self, mut collection: ZoteroCollection) -> Result<ZoteroCollection> {
        if collection.key.is_empty() {
            collection.key = Uuid::new_v4().to_string();
        }
        
        collection.date_added = Some(Utc::now().to_rfc3339());
        collection.date_modified = Some(Utc::now().to_rfc3339());
        
        // Store in local cache
        self.cache_collection(&collection).await?;
        
        // If API client is available, sync with Zotero
        if let Some(ref _client) = self.client {
            // This would create the collection via the Zotero API
            info!("Collection {} created locally, API sync pending", collection.name);
        }
        
        info!("Created new collection: {}", collection.name);
        Ok(collection)
    }

    /// Update a collection
    pub async fn update_collection(&self, mut collection: ZoteroCollection) -> Result<ZoteroCollection> {
        // Check if collection exists
        if !self.collection_exists(&collection.key).await? {
            return Err(ZoteroError::CollectionNotFound(collection.key));
        }
        
        collection.date_modified = Some(Utc::now().to_rfc3339());
        
        // Update in local cache
        self.cache_collection(&collection).await?;
        
        // If API client is available, sync with Zotero
        if let Some(ref _client) = self.client {
            // This would update the collection via the Zotero API
            info!("Collection {} updated locally, API sync pending", collection.name);
        }
        
        info!("Updated collection: {}", collection.name);
        Ok(collection)
    }

    /// Delete a collection
    pub async fn delete_collection(&self, collection_key: &str) -> Result<()> {
        // Check if collection exists
        if !self.collection_exists(collection_key).await? {
            return Err(ZoteroError::CollectionNotFound(collection_key.to_string()));
        }
        
        // Remove from local cache
        self.collections_tree.remove(collection_key.as_bytes())?;
        
        // If API client is available, delete from Zotero
        if let Some(ref _client) = self.client {
            // This would delete the collection via the Zotero API
            info!("Collection {} deleted locally, API sync pending", collection_key);
        }
        
        info!("Deleted collection: {}", collection_key);
        Ok(())
    }

    // Helper methods for caching
    
    async fn cache_item(&self, item: &ZoteroItem) -> Result<()> {
        let item_bytes = bincode::serialize(item)?;
        self.items_tree.insert(item.key.as_bytes(), item_bytes)?;
        self.db.flush_async().await?;
        Ok(())
    }

    async fn cache_collection(&self, collection: &ZoteroCollection) -> Result<()> {
        let collection_bytes = bincode::serialize(collection)?;
        self.collections_tree.insert(collection.key.as_bytes(), collection_bytes)?;
        self.db.flush_async().await?;
        Ok(())
    }

    async fn get_cached_items(&self) -> Result<Vec<ZoteroItem>> {
        let mut items = Vec::new();
        
        for item_result in self.items_tree.iter() {
            let (_, item_bytes) = item_result?;
            let item: ZoteroItem = bincode::deserialize(&item_bytes)?;
            items.push(item);
        }
        
        Ok(items)
    }

    async fn get_cached_collections(&self) -> Result<Vec<ZoteroCollection>> {
        let mut collections = Vec::new();
        
        for collection_result in self.collections_tree.iter() {
            let (_, collection_bytes) = collection_result?;
            let collection: ZoteroCollection = bincode::deserialize(&collection_bytes)?;
            collections.push(collection);
        }
        
        Ok(collections)
    }

    async fn item_exists(&self, item_key: &str) -> Result<bool> {
        Ok(self.items_tree.contains_key(item_key.as_bytes())?)
    }

    async fn collection_exists(&self, collection_key: &str) -> Result<bool> {
        Ok(self.collections_tree.contains_key(collection_key.as_bytes())?)
    }

    /// Get current configuration
    pub async fn get_config(&self) -> ZoteroConfig {
        self.config.read().await.clone()
    }

    /// Check if configured
    pub async fn is_configured(&self) -> bool {
        let config = self.config.read().await;
        !config.api_key.is_empty() && 
        (config.user_id.is_some() || config.group_id.is_some())
    }

    /// Clear all cached data
    pub async fn clear_cache(&self) -> Result<()> {
        self.items_tree.clear()?;
        self.collections_tree.clear()?;
        self.db.flush_async().await?;
        info!("Cleared all cached data");
        Ok(())
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> Result<(usize, usize)> {
        let item_count = self.items_tree.len();
        let collection_count = self.collections_tree.len();
        Ok((item_count, collection_count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_zotero_manager_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_zotero");
        
        let manager = ZoteroManager::new(db_path).await.unwrap();
        assert!(!manager.is_configured().await);
    }

    #[tokio::test]
    async fn test_zotero_configuration() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_zotero");
        
        let mut manager = ZoteroManager::new(db_path).await.unwrap();
        let config = ZoteroConfig::new_user("12345".to_string(), "api_key".to_string());
        
        manager.configure(config.clone()).await.unwrap();
        assert!(manager.is_configured().await);
        
        let loaded_config = manager.get_config().await;
        assert_eq!(loaded_config.user_id, config.user_id);
        assert_eq!(loaded_config.api_key, config.api_key);
    }

    #[tokio::test]
    async fn test_item_crud_operations() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_zotero");
        
        let manager = ZoteroManager::new(db_path).await.unwrap();
        let config = ZoteroConfig::new_user("12345".to_string(), "api_key".to_string());
        manager.configure(config).await.unwrap();
        
        // Create item
        let mut item = ZoteroItem {
            key: "".to_string(),
            version: None,
            item_type: "journalArticle".to_string(),
            title: Some("Test Article".to_string()),
            creators: vec![],
            tags: vec![],
            date_added: None,
            date_modified: None,
            abstract_note: None,
            url: None,
            doi: None,
            isbn: None,
            publication_title: None,
            volume: None,
            issue: None,
            pages: None,
            publisher: None,
            date: None,
            language: None,
            notes: vec![],
            attachments: vec![],
        };
        
        let created_item = manager.create_item(item.clone()).await.unwrap();
        assert!(created_item.date_added.is_some());
        assert!(created_item.date_modified.is_some());
        
        // Get items
        let items = manager.get_items().await.unwrap();
        assert_eq!(items.len(), 1);
        
        // Update item
        let mut updated_item = created_item.clone();
        updated_item.title = Some("Updated Article".to_string());
        let result = manager.update_item(updated_item).await.unwrap();
        assert_eq!(result.title, Some("Updated Article".to_string()));
        
        // Delete item
        manager.delete_item(&result.key).await.unwrap();
        let items_after_delete = manager.get_items().await.unwrap();
        assert_eq!(items_after_delete.len(), 0);
    }

    #[tokio::test]
    async fn test_collection_crud_operations() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_zotero");
        
        let manager = ZoteroManager::new(db_path).await.unwrap();
        let config = ZoteroConfig::new_user("12345".to_string(), "api_key".to_string());
        manager.configure(config).await.unwrap();
        
        // Create collection
        let mut collection = ZoteroCollection {
            key: "".to_string(),
            name: "Test Collection".to_string(),
            parent_collection: None,
            version: None,
            date_added: None,
            date_modified: None,
        };
        
        let created_collection = manager.create_collection(collection.clone()).await.unwrap();
        assert!(created_collection.date_added.is_some());
        assert!(created_collection.date_modified.is_some());
        
        // Get collections
        let collections = manager.get_collections().await.unwrap();
        assert_eq!(collections.len(), 1);
        
        // Update collection
        let mut updated_collection = created_collection.clone();
        updated_collection.name = "Updated Collection".to_string();
        let result = manager.update_collection(updated_collection).await.unwrap();
        assert_eq!(result.name, "Updated Collection");
        
        // Delete collection
        manager.delete_collection(&result.key).await.unwrap();
        let collections_after_delete = manager.get_collections().await.unwrap();
        assert_eq!(collections_after_delete.len(), 0);
    }

    #[tokio::test]
    async fn test_search_items() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test_zotero");
        
        let manager = ZoteroManager::new(db_path).await.unwrap();
        let config = ZoteroConfig::new_user("12345".to_string(), "api_key".to_string());
        manager.configure(config).await.unwrap();
        
        // Create test items
        let item1 = ZoteroItem {
            key: "1".to_string(),
            version: None,
            item_type: "journalArticle".to_string(),
            title: Some("Rust Programming".to_string()),
            creators: vec![Creator {
                creator_type: "author".to_string(),
                first_name: Some("Steve".to_string()),
                last_name: Some("Klabnik".to_string()),
            }],
            tags: vec![Tag { tag: "rust".to_string(), type_: None }],
            date_added: None,
            date_modified: None,
            abstract_note: None,
            url: None,
            doi: None,
            isbn: None,
            publication_title: None,
            volume: None,
            issue: None,
            pages: None,
            publisher: None,
            date: None,
            language: None,
            notes: vec![],
            attachments: vec![],
        };
        
        let item2 = ZoteroItem {
            key: "2".to_string(),
            version: None,
            item_type: "book".to_string(),
            title: Some("Python Programming".to_string()),
            creators: vec![],
            tags: vec![Tag { tag: "python".to_string(), type_: None }],
            date_added: None,
            date_modified: None,
            abstract_note: None,
            url: None,
            doi: None,
            isbn: None,
            publication_title: None,
            volume: None,
            issue: None,
            pages: None,
            publisher: None,
            date: None,
            language: None,
            notes: vec![],
            attachments: vec![],
        };
        
        manager.create_item(item1).await.unwrap();
        manager.create_item(item2).await.unwrap();
        
        // Search by title
        let rust_results = manager.search_items("rust").await.unwrap();
        assert_eq!(rust_results.len(), 1);
        assert_eq!(rust_results[0].title, Some("Rust Programming".to_string()));
        
        // Search by author
        let author_results = manager.search_items("Klabnik").await.unwrap();
        assert_eq!(author_results.len(), 1);
        
        // Search by tag
        let tag_results = manager.search_items("python").await.unwrap();
        assert_eq!(tag_results.len(), 1);
        assert_eq!(tag_results[0].title, Some("Python Programming".to_string()));
    }
}
