use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub is_online: bool,
    pub last_seen: Option<u64>,
    pub connection_type: Option<String>,
    pub profile_pic: Option<String>,
    pub about: Option<String>,
    pub college: Option<String>,
    pub reg_no: Option<String>,
}

pub struct UsersSection {
    users: Vec<UserInfo>,
    selected_user: Option<usize>,
    refresh_timer: f32,
}

impl Default for UsersSection {
    fn default() -> Self {
        Self {
            users: Vec::new(),
            selected_user: None,
            refresh_timer: 0.0,
        }
    }
}

impl UsersSection {
    pub fn ui(&mut self, ui: &mut egui::Ui) {
        ui.heading("👥 Users");
        ui.add_space(8.0);
        
        // Refresh button
        if ui.button("🔄 Refresh Users").clicked() {
            self.refresh_users();
        }
        
        ui.add_space(4.0);
        
        // User statistics
        let online_count = self.users.iter().filter(|u| u.is_online).count();
        let offline_count = self.users.len() - online_count;
        
        ui.horizontal(|ui| {
            ui.label(format!("Total: {}", self.users.len()));
            ui.separator();
            ui.label(format!("🟢 Online: {}", online_count));
            ui.label(format!("🔴 Offline: {}", offline_count));
        });
        
        ui.add_space(8.0);
        
        // Users list
        egui::ScrollArea::vertical()
            .id_source("users_list")
            .show(ui, |ui| {
                for (i, user) in self.users.iter_mut().enumerate() {
                    let is_selected = self.selected_user == Some(i);
                    
                    ui.horizontal(|ui| {
                        // User avatar/indicator
                        let avatar_text = if user.is_online { "🟢" } else { "🔴" };
                        if ui.selectable_label(is_selected, format!("{} {}", avatar_text, user.name)).clicked() {
                            self.selected_user = Some(i);
                        }
                        
                        // Connection type indicator
                        if let Some(conn_type) = &user.connection_type {
                            let conn_icon = match conn_type.as_str() {
                                "internet" => "🌐",
                                "lan" => "🏠",
                                "ble" => "📶",
                                "local" => "🔗",
                                _ => "❓",
                            };
                            ui.label(conn_icon);
                        }
                        
                        // Last seen
                        if let Some(last_seen) = user.last_seen {
                            let duration = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs() as u64;
                            
                            if last_seen > 0 {
                                let time_diff = duration.saturating_sub(last_seen);
                                let time_str = if time_diff < 60 {
                                    format!("{}s ago", time_diff)
                                } else if time_diff < 3600 {
                                    format!("{}m ago", time_diff / 60)
                                } else if time_diff < 86400 {
                                    format!("{}h ago", time_diff / 3600)
                                } else {
                                    format!("{}d ago", time_diff / 86400)
                                };
                                ui.label(time_str);
                            }
                        }
                    });
                    
                    // Show user details if selected
                    if is_selected {
                        ui.indent(|ui| {
                            ui.horizontal(|ui| {
                                ui.label("ID:");
                                ui.label(&user.id);
                            });
                            
                            if let Some(about) = &user.about {
                                ui.horizontal(|ui| {
                                    ui.label("About:");
                                    ui.label(about);
                                });
                            }
                            
                            if let Some(college) = &user.college {
                                ui.horizontal(|ui| {
                                    ui.label("College:");
                                    ui.label(college);
                                });
                            }
                            
                            if let Some(reg_no) = &user.reg_no {
                                ui.horizontal(|ui| {
                                    ui.label("Reg No:");
                                    ui.label(reg_no);
                                });
                            }
                            
                            if let Some(profile_pic) = &user.profile_pic {
                                ui.horizontal(|ui| {
                                    ui.label("Profile:");
                                    ui.label(profile_pic);
                                });
                            }
                        });
                    }
                }
            });
    }
    
    pub fn update(&mut self, ctx: &egui::Context) {
        // Auto-refresh every 5 seconds
        self.refresh_timer += ctx.input(|i| i.stable_dt);
        if self.refresh_timer > 5.0 {
            self.refresh_users();
            self.refresh_timer = 0.0;
        }
    }
    
    fn refresh_users(&mut self) {
        // For now, create mock data since we can't directly access libqaul from web
        // In a real implementation, this would call the libqaul API
        self.users = vec![
            UserInfo {
                id: "user1".to_string(),
                name: "Alice Johnson".to_string(),
                is_online: true,
                last_seen: Some(1704567890),
                connection_type: Some("internet".to_string()),
                profile_pic: Some("alice.png".to_string()),
                about: Some("Computer Science student".to_string()),
                college: Some("University of Technology - CS2023001".to_string()),
                reg_no: Some("CS2023001".to_string()),
            },
            UserInfo {
                id: "user2".to_string(),
                name: "Bob Smith".to_string(),
                is_online: false,
                last_seen: Some(1704560000),
                connection_type: None,
                profile_pic: Some("bob.png".to_string()),
                about: Some("Engineering student".to_string()),
                college: Some("University of Technology - EN2023002".to_string()),
                reg_no: Some("EN2023002".to_string()),
            },
        ];
    }
}