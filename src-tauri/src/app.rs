use std::{cell::RefCell, rc::Rc};

use hframe::Aware;

use crate::rtsp_player::{RtspPlayer, PlayerState};
use crate::document_viewer::{DocumentViewer, DocumentType};
use crate::file_explorer::FileExplorer;

fn format_file_size(bytes: u64) -> String {
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

#[cfg(not(target_arch = "wasm32"))]
use crate::tauri::invoke;

pub struct App {
    count: i32,
    greet_name: String,
    greet_output: Rc<RefCell<String>>,
    rtsp_player: RtspPlayer,
    rtsp_url: String,
    rtsp_status: String,
    document_viewer: DocumentViewer,
    file_path_input: String,
    file_explorer: FileExplorer,
    dark_mode: bool,
}

impl Default for App {
    fn default() -> Self {
        let mut file_explorer = FileExplorer::new();
        if let Err(e) = file_explorer.refresh() {
            eprintln!("Failed to initialize file explorer: {}", e);
        }
        
        Self {
            count: 0,
            greet_name: "Kagome Higurashi".to_owned(),
            greet_output: Rc::new(RefCell::new("".to_owned())),
            rtsp_player: RtspPlayer::new(),
            rtsp_url: "rtsp://localhost:8554/demo".to_string(),
            rtsp_status: "Ready".to_string(),
            document_viewer: DocumentViewer::new(),
            file_path_input: String::new(),
            file_explorer,
            dark_mode: true,
        }
    }
}

impl App {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        Default::default()
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Apply theme
        if self.dark_mode {
            ctx.set_visuals(egui::Visuals::dark());
        } else {
            ctx.set_visuals(egui::Visuals::light());
        }

        // Update RTSP status
        self.rtsp_status = match self.rtsp_player.get_state() {
            PlayerState::Stopped => "Stopped".to_string(),
            PlayerState::Connecting => "Connecting...".to_string(),
            PlayerState::Playing => "Playing".to_string(),
            PlayerState::Error(err) => format!("Error: {}", err),
        };

        // Theme Toggle Window
        egui::Window::new("🎨 Theme")
            .show(ctx, |ui| {
                ui.heading("Theme Settings");
                ui.add_space(8.0);
                
                ui.horizontal(|ui| {
                    let dark_button = ui.add(egui::Button::new("🌙 Dark Mode")
                        .fill(if self.dark_mode { egui::Color32::from_rgb(100, 100, 200) } else { egui::Color32::from_rgb(60, 60, 60) }));
                    if dark_button.clicked() {
                        self.dark_mode = true;
                    }
                    
                    let light_button = ui.add(egui::Button::new("☀️ Light Mode")
                        .fill(if !self.dark_mode { egui::Color32::from_rgb(200, 200, 100) } else { egui::Color32::from_rgb(60, 60, 60) }));
                    if light_button.clicked() {
                        self.dark_mode = false;
                    }
                });
                
                ui.add_space(8.0);
                ui.label("Current theme: ");
                ui.label(if self.dark_mode { "Dark Mode" } else { "Light Mode" });
            });

        egui::Window::new("RTSP Player")
            .show(ctx, |ui| {
                ui.label("MediaMTX Server Status: Running on ports 8554 (RTSP), 1935 (RTMP), 8888 (HLS)");
                ui.add_space(8.0);
                
                ui.horizontal(|ui| {
                    ui.label("RTSP URL:");
                    ui.text_edit_singleline(&mut self.rtsp_url);
                });
                
                // Preset stream URLs for testing
                ui.label("Quick test streams:");
                ui.horizontal(|ui| {
                    if ui.button("Demo Stream").clicked() {
                        self.rtsp_url = "rtsp://127.0.0.1:8554/demo".to_string();
                    }
                    if ui.button("Test Stream 1").clicked() {
                        self.rtsp_url = "rtsp://127.0.0.1:8554/stream".to_string();
                    }
                    if ui.button("Test Stream 2").clicked() {
                        self.rtsp_url = "rtsp://127.0.0.1:8554/stream2".to_string();
                    }
                    if ui.button("Webcam").clicked() {
                        self.rtsp_url = "rtsp://127.0.0.1:8554/webcam".to_string();
                    }
                });
                
                ui.horizontal(|ui| {
                    if ui.button("Play").clicked() {
                        self.rtsp_player.set_url(self.rtsp_url.clone());
                        if let Err(err) = self.rtsp_player.play() {
                            self.rtsp_status = format!("Failed to start: {}", err);
                        }
                    }
                    
                    if ui.button("Stop").clicked() {
                        self.rtsp_player.stop();
                    }
                });
                
                ui.separator();
                ui.label(format!("Status: {}", self.rtsp_status));
                
                // Show video preview area
                let frame = self.rtsp_player.get_current_frame();
                if let Some(_frame) = frame {
                    ui.separator();
                    ui.label("Video Preview (Simulated):");
                    // Create a smaller colored rectangle to simulate video and reduce performance impact
                    let (rect, _) = ui.allocate_exact_size(egui::Vec2::new(320.0, 240.0), egui::Sense::hover());
                    let painter = ui.painter();
                    
                    // Create a gradient effect to simulate video with less frequent updates
                    let time = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as f32;
                    
                    // Reduce the number of gradient bands to improve performance
                    for i in 0..5 {
                        let y = rect.min.y + (i as f32 * rect.height() / 5.0);
                        let color_intensity = ((time * 20.0 + i as f32 * 50.0) % 255.0) / 255.0;
                        let color = egui::Color32::from_rgb(
                            (color_intensity * 255.0) as u8,
                            ((1.0 - color_intensity) * 255.0) as u8,
                            (color_intensity * 128.0) as u8,
                        );
                        painter.rect_filled(
                            egui::Rect::from_min_max(
                                egui::pos2(rect.min.x, y),
                                egui::pos2(rect.max.x, y + rect.height() / 5.0)
                            ),
                            0.0,
                            color,
                        );
                    }
                    
                    painter.text(
                        rect.center(),
                        egui::Align2::CENTER_CENTER,
                        "📹 Stream Active",
                        egui::FontId::default(),
                        egui::Color32::WHITE,
                    );
                } else {
                    ui.separator();
                    ui.label("No video stream active");
                    // Reduce the size of the placeholder area to improve performance
                    ui.allocate_ui(egui::Vec2::new(320.0, 240.0), |ui| {
                        ui.centered_and_justified(|ui| {
                            ui.vertical_centered(|ui| {
                                ui.label("📹");
                                ui.label("Connect to an RTSP stream to see video here");
                                ui.add_space(4.0);
                                ui.label("MediaMTX is ready to receive streams");
                            });
                        });
                    });
                }
                
                ui.add_space(8.0);
                ui.label("💡 Tips:");
                ui.label("• Use FFmpeg: ffmpeg -re -i video.mp4 -c copy rtsp://127.0.0.1:8554/stream");
                ui.label("• Use OBS Studio: Settings → Stream → Custom → rtsp://127.0.0.1:8554/stream");
                ui.label("• Check MediaMTX logs for incoming connections");
            })
            .aware();

        egui::Window::new("Document Viewer")
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label("File Path:");
                    ui.text_edit_singleline(&mut self.file_path_input);
                    if ui.button("Open").clicked() {
                        if !self.file_path_input.is_empty() {
                            if let Err(err) = self.document_viewer.add_document(self.file_path_input.clone(), b"demo content".to_vec()) {
                                // Handle error - could show in UI
                                eprintln!("Failed to open document: {}", err);
                            }
                            self.file_path_input.clear();
                        }
                    }
                    
                    // Add file browser button for desktop
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        if ui.button("Browse...").clicked() {
                            // Simple file browser simulation for now
                            // In a real implementation, you would use rfd or similar
                            self.file_path_input = "C:\\path\\to\\your\\document.pdf".to_string();
                            ui.label("File browser clicked - enter path manually or use the demo below");
                        }
                    }
                    
                    #[cfg(target_arch = "wasm32")]
                    {
                        if ui.button("Browse (Web)").clicked() {
                            // For web, we'll show a simple file input
                            ui.label("Web file selection - enter path manually");
                        }
                    }
                });
                
                // Add demo document buttons for testing
                ui.separator();
                ui.label("Quick Demo Documents:");
                ui.horizontal(|ui| {
                    if ui.button("Demo PDF").clicked() {
                        let _ = self.document_viewer.add_document("demo_document.pdf".to_string(), b"demo pdf content".to_vec());
                    }
                    if ui.button("Demo PowerPoint").clicked() {
                        let _ = self.document_viewer.add_document("demo_presentation.pptx".to_string(), b"demo powerpoint content".to_vec());
                    }
                    if ui.button("Demo Word").clicked() {
                        let _ = self.document_viewer.add_document("demo_document.docx".to_string(), b"demo word content".to_vec());
                    }
                    if ui.button("Demo Text").clicked() {
                        let _ = self.document_viewer.add_document("demo_text.txt".to_string(), b"demo text content".to_vec());
                    }
                    if ui.button("Demo Image").clicked() {
                        // Create a simple 1x1 PNG image for testing
                        let png_data = include_bytes!("../assets/icon-256.png");
                        let _ = self.document_viewer.add_document("demo_image.png".to_string(), png_data.to_vec());
                    }
                });
                
                ui.separator();
                
                // Document list
                ui.label("Open Documents:");
                let documents = self.document_viewer.get_document_list().clone();
                let current_document_name = self.document_viewer.get_current_document()
                    .map(|d| d.name.clone());
                
                if documents.is_empty() {
                    ui.label("No documents open - click demo buttons above to test");
                } else {
                    for (i, doc) in documents.iter().enumerate() {
                        let is_current = current_document_name.as_ref()
                            .map(|current_name| current_name == &doc.name)
                            .unwrap_or(false);
                        
                        ui.horizontal(|ui| {
                            if ui.selectable_label(is_current, &doc.name).clicked() {
                                self.document_viewer.set_current_document(i);
                            }
                            
                            ui.label(format!("({:?})", doc.document_type));
                            
                            if ui.button("×").clicked() {
                                // Remove document logic would go here
                                // For now, we'll just skip implementation
                            }
                        });
                    }
                }
                
                ui.separator();
                
                // Current document viewer
                if let Some(document) = self.document_viewer.get_current_document() {
                    let document_info = (document.name.clone(), document.document_type.clone(), document.current_page, document.total_pages());
                    
                    ui.horizontal(|ui| {
                        ui.label(format!("📄 {}", document_info.0));
                        ui.label(format!("({:?})", document_info.1));
                        
                        // Navigation for multi-page documents
                        match document_info.1 {
                            DocumentType::PDF | DocumentType::PowerPoint => {
                                ui.separator();
                                ui.label(format!("Page {} of {}", document_info.2, document_info.3));
                                
                                if ui.button("◀").clicked() {
                                    if let Some(doc) = self.document_viewer.get_current_document_mut() {
                                        doc.previous_page();
                                    }
                                }
                                if ui.button("▶").clicked() {
                                    if let Some(doc) = self.document_viewer.get_current_document_mut() {
                                        doc.next_page();
                                    }
                                }
                            }
                            _ => {}
                        }
                    });
                    
                    ui.separator();
                    
                    // Document content area
                    egui::ScrollArea::vertical()
                        .id_source("document_content")
                        .show(ui, |ui| {
                            if let Some(document) = self.document_viewer.get_current_document() {
                                match document.document_type {
                                    DocumentType::Image => {
                                        // Show image preview
                                        if let Some(color_image) = document.get_current_image() {
                                            let available_size = ui.available_size();
                                            let image_size = egui::vec2(color_image.width() as f32, color_image.height() as f32);
                                            
                                            // Scale image to fit available space while maintaining aspect ratio
                                            let scale = (available_size.x / image_size.x).min(available_size.y / image_size.y).min(1.0);
                                            let scaled_size = image_size * scale;
                                            
                                            ui.centered_and_justified(|ui| {
                                                // Load texture and display image
                                                let texture_id = ui.ctx().load_texture(
                                                    "document_image",
                                                    color_image,
                                                    egui::TextureOptions::default()
                                                );
                                                ui.add(egui::Image::from_texture(
                                                    egui::load::SizedTexture::new(scaled_size, texture_id)
                                                ));
                                            });
                                        } else {
                                            ui.label("Failed to load image");
                                        }
                                    }
                                    _ => {
                                        // Show text content for other document types
                                        ui.label(&self.document_viewer.get_current_page_content());
                                    }
                                }
                            } else {
                                ui.label("No document selected");
                            }
                        });
                } else {
                    ui.centered_and_justified(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.label("📄");
                            ui.label("No document selected");
                            ui.label("Click demo buttons above to test the viewer");
                        });
                    });
                }
                
                ui.add_space(8.0);
                ui.label("💡 Supported formats:");
                ui.label("• PDF (.pdf)");
                ui.label("• PowerPoint (.ppt, .pptx)");
                ui.label("• Word (.doc, .docx)");
                ui.label("• Text (.txt, .md)");
                ui.label("• Images (.png, .jpg, .gif, .bmp)");
            })
            .aware();

        egui::Window::new("📁 KNOWLIA#NOTES Explorer")
            .show(ctx, |ui| {
                // Get data before using it
                let breadcrumb = self.file_explorer.get_breadcrumb();
                let can_go_to_parent = self.file_explorer.can_go_to_parent();
                
                // Breadcrumb navigation
                ui.horizontal(|ui| {
                    ui.label("📍");
                    ui.label(breadcrumb);
                    
                    if ui.button("🏠").clicked() {
                        self.file_explorer.set_root_path(r"C:\Users\PC\Documents\KNOWLIA#NOTES");
                        if let Err(e) = self.file_explorer.refresh() {
                            eprintln!("Failed to refresh file explorer: {}", e);
                        }
                    }
                    
                    if can_go_to_parent {
                        if ui.button("⬆️ Parent").clicked() {
                            let _ = self.file_explorer.navigate_to_parent();
                        }
                    }
                    
                    if ui.button("🔄 Refresh").clicked() {
                        if let Err(e) = self.file_explorer.refresh() {
                            eprintln!("Failed to refresh file explorer: {}", e);
                        }
                    }
                });
                
                ui.separator();
                
                // File list
                let items = self.file_explorer.get_items().to_vec();
                
                if items.is_empty() {
                    ui.centered_and_justified(|ui| {
                        ui.vertical_centered(|ui| {
                            ui.label("📂");
                            ui.label("Folder appears empty");
                            ui.label("Possible reasons:");
                            ui.label("• Folder doesn't exist");
                            ui.label("• Permission denied");
                            ui.label("• Path is incorrect");
                            ui.add_space(8.0);
                            ui.label(format!("Current path: {}", self.file_explorer.get_current_path().display()));
                            ui.add_space(4.0);
                            ui.label("Try clicking '🏠 Home' to reset to root path");
                        });
                    });
                } else {
                    ui.label(format!("Found {} items", items.len()));
                    egui::ScrollArea::vertical()
                        .id_source("file_explorer")
                        .show(ui, |ui| {
                            for (i, item) in items.iter().enumerate() {
                                let is_selected = self.file_explorer.get_selected_item()
                                    .map(|selected| selected.path == item.path)
                                    .unwrap_or(false);
                                
                                ui.horizontal(|ui| {
                                    // File/folder icon
                                    let icon = match item.item_type {
                                        crate::file_explorer::FileItemType::Directory => "📁",
                                        crate::file_explorer::FileItemType::File => {
                                            if item.is_pdf() { "📄" }
                                            else if item.is_powerpoint() { "📊" }
                                            else if item.is_word() { "📝" }
                                            else if item.is_text() { "📃" }
                                            else if item.is_image() { "🖼️" }
                                            else { "📎" }
                                        }
                                    };
                                    
                                    if ui.selectable_label(is_selected, format!("{} {}", icon, item.name)).clicked() {
                                        self.file_explorer.set_selected(i);
                                        
                                        // Double-click to navigate or open
                                        if ui.input(|i| i.pointer.secondary_clicked()) {
                                            if item.item_type == crate::file_explorer::FileItemType::Directory {
                                                let _ = self.file_explorer.navigate_into(i);
                                            } else if item.is_supported_document() {
                                                // Open document in viewer
                                                let path_str = item.path.to_string_lossy().to_string();
                                                if let Err(e) = self.document_viewer.add_document(path_str, b"file content".to_vec()) {
                                                    eprintln!("Failed to open document: {}", e);
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Size display for files
                                    if let (crate::file_explorer::FileItemType::File, Some(size)) = (&item.item_type, item.size) {
                                        ui.label(format!("({})", format_file_size(size)));
                                    }
                                    
                                    // Open button for supported documents
                                    if item.item_type == crate::file_explorer::FileItemType::File && item.is_supported_document() {
                                        if ui.button("📖 Open").clicked() {
                                            let path_str = item.path.to_string_lossy().to_string();
                                            if let Err(e) = self.document_viewer.add_document(path_str, b"file content".to_vec()) {
                                                eprintln!("Failed to open document: {}", e);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                }
                
                ui.separator();
                ui.label("💡 Tips:");
                ui.label("• Click folders to navigate");
                ui.label("• Click '📖 Open' to view documents");
                ui.label("• Right-click to navigate or open");
                ui.label("• Supported: PDF, PowerPoint, Word, Text, Images");
            })
            .aware();

        hframe::sync(ctx);
    }
}
