use anyhow::{Result, anyhow};

// Using pdf crate.
// Note: Ensure your Cargo.toml enables "text-extraction" feature.
use pdf::file::File as PdfFile;

#[derive(Debug, Clone, PartialEq)]
pub enum DocumentType {
    PDF,
    PowerPoint,
    Word,
    Text,
    Image,
}

#[derive(Debug, Clone)]
pub struct Document {
    pub name: String,
    pub document_type: DocumentType,
    // We store text per page to make previewing accurate
    pub pages: Vec<String>,
    pub current_page: usize,
    // Store image data for image documents
    pub image_data: Option<Vec<u8>>,
}

impl Document {
    /// Creates a new Document from raw bytes (e.g., from a browser upload).
    /// This works in both Native and WASM environments.
    pub fn from_bytes(name: String, data: Vec<u8>) -> Result<Self> {
        // Determine document type based on file extension and content
        let document_type = Self::detect_document_type(&name, &data);
        
        match document_type {
            DocumentType::PDF => {
                let pages = Self::extract_pdf_content(&data)?;
                if pages.is_empty() {
                    return Err(anyhow!("PDF has no pages or could not be read."));
                }
                Ok(Self {
                    name,
                    document_type,
                    pages,
                    current_page: 1,
                    image_data: None,
                })
            }
            DocumentType::Image => {
                Ok(Self {
                    name,
                    document_type,
                    pages: vec!["Image preview".to_string()],
                    current_page: 1,
                    image_data: Some(data),
                })
            }
            _ => {
                // For other document types, create a simple text representation
                let text_content = String::from_utf8_lossy(&data);
                let pages = if text_content.is_empty() {
                    vec!["[Empty document]".to_string()]
                } else {
                    vec![text_content.to_string()]
                };
                Ok(Self {
                    name,
                    document_type,
                    pages,
                    current_page: 1,
                    image_data: None,
                })
            }
        }
    }

    /// Detect document type based on file extension and content
    fn detect_document_type(name: &str, data: &[u8]) -> DocumentType {
        let name_lower = name.to_lowercase();
        
        // Check by file extension
        if name_lower.ends_with(".pdf") {
            DocumentType::PDF
        } else if name_lower.ends_with(".png") || name_lower.ends_with(".jpg") || 
                  name_lower.ends_with(".jpeg") || name_lower.ends_with(".gif") || 
                  name_lower.ends_with(".bmp") || name_lower.ends_with(".webp") {
            DocumentType::Image
        } else if name_lower.ends_with(".ppt") || name_lower.ends_with(".pptx") {
            DocumentType::PowerPoint
        } else if name_lower.ends_with(".doc") || name_lower.ends_with(".docx") {
            DocumentType::Word
        } else if name_lower.ends_with(".txt") || name_lower.ends_with(".md") {
            DocumentType::Text
        } else {
            // Check by magic bytes for images
            if data.len() >= 4 {
                let header = &data[..4];
                if header.starts_with(b"\x89PNG") {
                    DocumentType::Image
                } else if header.starts_with(b"\xFF\xD8\xFF") {
                    DocumentType::Image
                } else if header.starts_with(b"GIF8") {
                    DocumentType::Image
                } else if header.starts_with(b"BM") {
                    DocumentType::Image
                } else if data.starts_with(b"%PDF") {
                    DocumentType::PDF
                } else {
                    DocumentType::Text // Default to text
                }
            } else {
                DocumentType::Text // Default to text
            }
        }
    }
    
    /// Extracts text from PDF bytes and returns a vector of strings, one per page.
    fn extract_pdf_content(data: &[u8]) -> Result<Vec<String>> {
        // Load PDF from memory (works for browser uploads)
        // We use FileOptions or simply load from a cursor. 
        // pdf crate's `load_from` usually takes a reader that implements std::io::Read.
        use std::io::Cursor;
        
        let cursor = Cursor::new(data);
        let pdf_file = PdfFile::read(cursor)?;
        
        let mut extracted_pages = Vec::new();
        
        for (page_num, page) in pdf_file.pages().enumerate() {
            // The 'pdf' crate extracts text based on content operations.
            let mut page_text = String::new();
            
            match page.extract_text() {
                Ok(text) => {
                    // Clean up whitespace slightly for better viewing
                    let clean_text: String = text
                        .lines()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect::<Vec<_>>()
                        .join("\n");
                    
                    if clean_text.is_empty() {
                        page_text = format!("[Page {} contains no extractable text]", page_num + 1);
                    } else {
                        page_text = clean_text;
                    }
                }
                Err(_) => {
                    page_text = format!("[Could not extract text from Page {}]", page_num + 1);
                }
            }
            
            extracted_pages.push(page_text);
        }
        
        Ok(extracted_pages)
    }

    pub fn get_image_data(&self) -> Option<&Vec<u8>> {
        self.image_data.as_ref()
    }
    
    pub fn get_current_image(&self) -> Option<egui::ColorImage> {
        if let Some(image_data) = &self.image_data {
            // Try to load image from bytes
            self.load_image_from_bytes(image_data)
        } else {
            None
        }
    }
    
    fn load_image_from_bytes(&self, image_data: &[u8]) -> Option<egui::ColorImage> {
        // Use image crate to load from bytes
        use image::ImageFormat;
        
        let image_result = image::load_from_memory(image_data);
        match image_result {
            Ok(img) => {
                let rgba = img.to_rgba8();
                let size = [rgba.width() as usize, rgba.height() as usize];
                let color_image = egui::ColorImage::from_rgba_unmultiplied(size, &rgba);
                Some(color_image)
            }
            Err(_) => None,
        }
    }

    pub fn get_current_page_content(&self) -> String {
        if self.pages.is_empty() {
            return "No content available.".to_string();
        }
        
        let index = self.current_page.saturating_sub(1);
        if index < self.pages.len() {
            self.pages[index].clone()
        } else {
            "Error: Page index out of bounds.".to_string()
        }
    }
    
    pub fn next_page(&mut self) {
        if self.current_page < self.pages.len() {
            self.current_page += 1;
        }
    }
    
    pub fn previous_page(&mut self) {
        if self.current_page > 1 {
            self.current_page -= 1;
        }
    }

    pub fn total_pages(&self) -> usize {
        self.pages.len()
    }
}

pub struct DocumentViewer {
    documents: Vec<Document>,
    current_document_index: Option<usize>,
}

impl DocumentViewer {
    pub fn new() -> Self {
        Self {
            documents: Vec::new(),
            current_document_index: None,
        }
    }
    
    /// Adds a document from raw file data (intended for use with Browser Uploads).
    /// In a WASM context, this would be hooked up to file input change event.
    pub fn add_document(&mut self, name: String, data: Vec<u8>) -> Result<()> {
        let document = Document::from_bytes(name, data)?;
        
        self.documents.push(document);
        
        // If this is the first document, select it automatically
        if self.current_document_index.is_none() {
            self.current_document_index = Some(0);
        }
        
        Ok(())
    }
    
    pub fn remove_current_document(&mut self) {
        if let Some(index) = self.current_document_index {
            if index < self.documents.len() {
                self.documents.remove(index);
                
                if self.documents.is_empty() {
                    self.current_document_index = None;
                } else if index >= self.documents.len() {
                    self.current_document_index = Some(self.documents.len().saturating_sub(1));
                }
            }
        }
    }
    
    pub fn get_current_document(&self) -> Option<&Document> {
        self.current_document_index.and_then(|index| self.documents.get(index))
    }
    
    pub fn get_current_document_mut(&mut self) -> Option<&mut Document> {
        self.current_document_index.and_then(|index| self.documents.get_mut(index))
    }
    
    pub fn next_document(&mut self) {
        if let Some(current) = self.current_document_index {
            if current + 1 < self.documents.len() {
                self.current_document_index = Some(current + 1);
            }
        }
    }
    
    pub fn previous_document(&mut self) {
        if let Some(current) = self.current_document_index {
            if current > 0 {
                self.current_document_index = Some(current - 1);
            }
        }
    }
    
    pub fn get_document_list(&self) -> &Vec<Document> {
        &self.documents
    }
    
    pub fn get_current_page_content(&self) -> String {
        if let Some(doc) = self.get_current_document() {
            doc.get_current_page_content()
        } else {
            "No document selected".to_string()
        }
    }
    
    pub fn set_current_document(&mut self, index: usize) {
        if index < self.documents.len() {
            self.current_document_index = Some(index);
        }
    }
}

impl Default for DocumentViewer {
    fn default() -> Self {
        Self::new()
    }
}
