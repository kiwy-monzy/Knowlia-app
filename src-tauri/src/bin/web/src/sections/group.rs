use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub member_count: usize,
    pub is_member: bool,
    pub created_at: Option<u64>,
    pub admin_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMember {
    pub id: String,
    pub name: String,
    pub is_admin: bool,
    pub joined_at: Option<u64>,
}

pub struct GroupSection {
    groups: Vec<GroupInfo>,
    selected_group: Option<usize>,
    members: Vec<GroupMember>,
    show_create_group: bool,
    new_group_name: String,
    new_group_description: String,
    refresh_timer: f32,
}

impl Default for GroupSection {
    fn default() -> Self {
        Self {
            groups: Vec::new(),
            selected_group: None,
            members: Vec::new(),
            show_create_group: false,
            new_group_name: String::new(),
            new_group_description: String::new(),
            refresh_timer: 0.0,
        }
    }
}

impl GroupSection {
    pub fn ui(&mut self, ui: &mut egui::Ui) {
        ui.heading("👥 Groups");
        ui.add_space(8.0);
        
        // Action buttons
        ui.horizontal(|ui| {
            if ui.button("🔄 Refresh Groups").clicked() {
                self.refresh_groups();
            }
            
            if ui.button("➕ Create Group").clicked() {
                self.show_create_group = true;
            }
        });
        
        ui.add_space(8.0);
        
        // Group statistics
        let member_groups = self.groups.iter().filter(|g| g.is_member).count();
        ui.horizontal(|ui| {
            ui.label(format!("Total: {}", self.groups.len()));
            ui.separator();
            ui.label(format!("👤 Member: {}", member_groups));
            ui.label(format!("👁️ Available: {}", self.groups.len() - member_groups));
        });
        
        ui.add_space(8.0);
        
        // Create group dialog
        if self.show_create_group {
            ui.group(|ui| {
                ui.heading("Create New Group");
                ui.add_space(4.0);
                
                ui.horizontal(|ui| {
                    ui.label("Name:");
                    ui.text_edit_singleline(&mut self.new_group_name);
                });
                
                ui.horizontal(|ui| {
                    ui.label("Description:");
                    ui.text_edit_multiline(&mut self.new_group_description);
                });
                
                ui.add_space(4.0);
                
                ui.horizontal(|ui| {
                    if ui.button("✅ Create").clicked() {
                        self.create_group();
                    }
                    
                    if ui.button("❌ Cancel").clicked() {
                        self.show_create_group = false;
                        self.new_group_name.clear();
                        self.new_group_description.clear();
                    }
                });
            });
            ui.add_space(8.0);
        }
        
        // Groups list
        egui::ScrollArea::vertical()
            .id_source("groups_list")
            .show(ui, |ui| {
                for (i, group) in self.groups.iter().enumerate() {
                    let is_selected = self.selected_group == Some(i);
                    
                    ui.horizontal(|ui| {
                        // Group selection
                        let group_icon = if group.is_member { "👤" } else { "👁️" };
                        if ui.selectable_label(is_selected, format!("{} {} ({})", group_icon, group.name, group.member_count)).clicked() {
                            self.selected_group = Some(i);
                            self.load_group_members(i);
                        }
                        
                        // Join/Leave button
                        if group.is_member {
                            if ui.button("🚪 Leave").clicked() {
                                self.leave_group(i);
                            }
                        } else {
                            if ui.button("➕ Join").clicked() {
                                self.join_group(i);
                            }
                        }
                    });
                    
                    // Show group details if selected
                    if is_selected {
                        ui.indent(|ui| {
                            if let Some(description) = &group.description {
                                ui.horizontal(|ui| {
                                    ui.label("Description:");
                                    ui.label(description);
                                });
                            }
                            
                            ui.horizontal(|ui| {
                                ui.label("ID:");
                                ui.label(&group.id);
                            });
                            
                            if let Some(admin_id) = &group.admin_id {
                                ui.horizontal(|ui| {
                                    ui.label("Admin:");
                                    ui.label(admin_id);
                                });
                            }
                            
                            if let Some(created_at) = group.created_at {
                                let created_str = std::time::UNIX_EPOCH
                                    .duration_since(std::time::Duration::from_secs(created_at))
                                    .unwrap_or_default()
                                    .as_secs();
                                
                                ui.horizontal(|ui| {
                                    ui.label("Created:");
                                    ui.label(format!("{}", created_str));
                                });
                            }
                            
                            // Show members
                            if !self.members.is_empty() {
                                ui.add_space(4.0);
                                ui.heading("Members:");
                                
                                for member in &self.members {
                                    ui.horizontal(|ui| {
                                        let role_icon = if member.is_admin { "👑" } else { "👤" };
                                        ui.label(format!("{} {}", role_icon, member.name));
                                        
                                        if let Some(joined_at) = member.joined_at {
                                            let joined_str = std::time::UNIX_EPOCH
                                                .duration_since(std::time::Duration::from_secs(joined_at))
                                                .unwrap_or_default()
                                                .as_secs();
                                            
                                            ui.label(format!("(joined: {})", joined_str));
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
    }
    
    pub fn update(&mut self, ctx: &egui::Context) {
        // Auto-refresh every 10 seconds
        self.refresh_timer += ctx.input(|i| i.stable_dt);
        if self.refresh_timer > 10.0 {
            self.refresh_groups();
            self.refresh_timer = 0.0;
        }
    }
    
    fn refresh_groups(&mut self) {
        // For now, create mock data since we can't directly access libqaul from web
        // In a real implementation, this would call the libqaul API
        self.groups = vec![
            GroupInfo {
                id: "group1".to_string(),
                name: "Computer Science Study Group".to_string(),
                description: Some("Study group for CS students".to_string()),
                member_count: 15,
                is_member: true,
                created_at: Some(1704567890),
                admin_id: Some("admin1".to_string()),
            },
            GroupInfo {
                id: "group2".to_string(),
                name: "Engineering Projects".to_string(),
                description: Some("Collaborative engineering projects".to_string()),
                member_count: 8,
                is_member: false,
                created_at: Some(1704560000),
                admin_id: Some("admin2".to_string()),
            },
            GroupInfo {
                id: "group3".to_string(),
                name: "General Discussion".to_string(),
                description: Some("General topics and discussions".to_string()),
                member_count: 25,
                is_member: true,
                created_at: Some(1704550000),
                admin_id: Some("admin3".to_string()),
            },
        ];
    }
    
    fn load_group_members(&mut self, group_index: usize) {
        if let Some(group) = self.groups.get(group_index) {
            // Mock member data
            self.members = vec![
                GroupMember {
                    id: "member1".to_string(),
                    name: "Alice Johnson".to_string(),
                    is_admin: group.admin_id.as_ref() == Some(&"member1".to_string()),
                    joined_at: Some(1704567890),
                },
                GroupMember {
                    id: "member2".to_string(),
                    name: "Bob Smith".to_string(),
                    is_admin: false,
                    joined_at: Some(1704568000),
                },
                GroupMember {
                    id: "member3".to_string(),
                    name: "Carol Davis".to_string(),
                    is_admin: false,
                    joined_at: Some(1704569000),
                },
            ];
        }
    }
    
    fn create_group(&mut self) {
        if !self.new_group_name.trim().is_empty() {
            let new_group = GroupInfo {
                id: format!("group_{}", self.groups.len() + 1),
                name: self.new_group_name.clone(),
                description: if self.new_group_description.trim().is_empty() {
                    None
                } else {
                    Some(self.new_group_description.clone())
                },
                member_count: 1,
                is_member: true,
                created_at: Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                ),
                admin_id: Some("current_user".to_string()),
            };
            
            self.groups.push(new_group);
            
            // Reset form
            self.show_create_group = false;
            self.new_group_name.clear();
            self.new_group_description.clear();
        }
    }
    
    fn join_group(&mut self, group_index: usize) {
        if let Some(group) = self.groups.get_mut(group_index) {
            group.is_member = true;
            group.member_count += 1;
        }
    }
    
    fn leave_group(&mut self, group_index: usize) {
        if let Some(group) = self.groups.get_mut(group_index) {
            group.is_member = false;
            group.member_count = group.member_count.saturating_sub(1);
        }
    }
}