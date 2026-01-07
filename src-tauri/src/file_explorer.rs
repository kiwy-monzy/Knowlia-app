use std::path::{Path, PathBuf};
use std::fs;
use anyhow::Result;

#[derive(Debug, Clone, PartialEq)]
pub enum FileItemType {
    File,
    Directory,
}

#[derive(Debug, Clone)]
pub struct FileItem {
    pub name: String,
    pub path: PathBuf,
    pub item_type: FileItemType,
    pub extension: Option<String>,
    pub size: Option<u64>,
}

impl FileItem {
    pub fn new(path: PathBuf) -> Result<Self> {
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();
        
        let metadata = fs::metadata(&path);
        let (item_type, size) = match metadata {
            Ok(meta) => {
                if meta.is_dir() {
                    (FileItemType::Directory, None)
                } else {
                    (FileItemType::File, Some(meta.len()))
                }
            }
            Err(_) => (FileItemType::File, None),
        };
        
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase());
        
        Ok(Self {
            name,
            path,
            item_type,
            extension,
            size,
        })
    }
    
    pub fn is_pdf(&self) -> bool {
        matches!(self.extension.as_deref(), Some("pdf"))
    }
    
    pub fn is_powerpoint(&self) -> bool {
        matches!(self.extension.as_deref(), Some("ppt") | Some("pptx"))
    }
    
    pub fn is_word(&self) -> bool {
        matches!(self.extension.as_deref(), Some("doc") | Some("docx"))
    }
    
    pub fn is_text(&self) -> bool {
        matches!(self.extension.as_deref(), Some("txt") | Some("md"))
    }
    
    pub fn is_image(&self) -> bool {
        matches!(self.extension.as_deref(), Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("bmp") | Some("svg"))
    }
    
    pub fn is_supported_document(&self) -> bool {
        self.is_pdf() || self.is_powerpoint() || self.is_word() || self.is_text() || self.is_image()
    }
}

pub struct FileExplorer {
    current_path: PathBuf,
    items: Vec<FileItem>,
    selected_index: Option<usize>,
    root_path: PathBuf,
}

impl FileExplorer {
    pub fn new() -> Self {
        let root_path = PathBuf::from(r"C:\Users\PC\Documents\KNOWLIA#NOTES");
        let current_path = root_path.clone();
        
        Self {
            current_path,
            items: Vec::new(),
            selected_index: None,
            root_path,
        }
    }
    
    pub fn set_root_path(&mut self, path: &str) {
        self.root_path = PathBuf::from(path);
        self.current_path = self.root_path.clone();
        self.refresh().ok(); // Ignore errors for now
    }
    
    pub fn refresh(&mut self) -> Result<()> {
        self.items.clear();
        
        // Check if path exists
        if !self.current_path.exists() {
            // Try to create directory if it doesn't exist
            fs::create_dir_all(&self.current_path)?;
            return Ok(());
        }
        
        // Check if it's actually a directory
        if !self.current_path.is_dir() {
            return Err(anyhow::anyhow!("Path is not a directory: {}", self.current_path.display()));
        }
        
        let mut entries = Vec::new();
        
        match fs::read_dir(&self.current_path) {
            Ok(dir_entries) => {
                for entry in dir_entries {
                    match entry {
                        Ok(entry) => {
                            let path = entry.path();
                            
                            // Skip hidden files and directories (starting with .)
                            if let Some(name) = path.file_name() {
                                if let Some(name_str) = name.to_str() {
                                    if name_str.starts_with('.') {
                                        continue;
                                    }
                                }
                            }
                            
                            if let Ok(item) = FileItem::new(path) {
                                entries.push(item);
                            }
                        }
                        Err(e) => {
                            eprintln!("Error reading directory entry: {}", e);
                            // Continue with other entries
                        }
                    }
                }
            }
            Err(e) => {
                return Err(anyhow::anyhow!("Failed to read directory {}: {}", self.current_path.display(), e));
            }
        }
        
        // Sort: directories first, then files, both alphabetically
        entries.sort_by(|a, b| {
            match (&a.item_type, &b.item_type) {
                (FileItemType::Directory, FileItemType::File) => std::cmp::Ordering::Less,
                (FileItemType::File, FileItemType::Directory) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        
        self.items = entries;
        self.selected_index = None;
        
        Ok(())
    }
    
    pub fn navigate_to_parent(&mut self) -> bool {
        if let Some(parent) = self.current_path.parent() {
            if parent >= self.root_path {
                self.current_path = parent.to_path_buf();
                let _ = self.refresh(); // Ignore errors
                return true;
            }
        }
        false
    }
    
    pub fn navigate_into(&mut self, index: usize) -> bool {
        if let Some(item) = self.items.get(index) {
            if item.item_type == FileItemType::Directory {
                self.current_path = item.path.clone();
                let _ = self.refresh(); // Ignore errors
                return true;
            }
        }
        false
    }
    
    pub fn get_selected_item(&self) -> Option<&FileItem> {
        self.selected_index.and_then(|i| self.items.get(i))
    }
    
    pub fn set_selected(&mut self, index: usize) {
        if index < self.items.len() {
            self.selected_index = Some(index);
        }
    }
    
    pub fn get_current_path(&self) -> &Path {
        &self.current_path
    }
    
    pub fn get_items(&self) -> &[FileItem] {
        &self.items
    }
    
    pub fn can_go_to_parent(&self) -> bool {
        self.current_path > self.root_path
    }
    
    pub fn get_breadcrumb(&self) -> String {
        if let Some(relative) = self.current_path.strip_prefix(&self.root_path).ok() {
            if relative == Path::new("") {
                "KNOWLIA#NOTES".to_string()
            } else {
                format!("KNOWLIA#NOTES\\{}", relative.display())
            }
        } else {
            format!("{}", self.current_path.display())
        }
    }
}

impl Default for FileExplorer {
    fn default() -> Self {
        Self::new()
    }
}
