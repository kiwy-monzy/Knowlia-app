

mod sections;

use sections::users::UsersSection;
use sections::group::GroupSection;

pub struct App {
    dark_mode: bool,
    users_section: UsersSection,
    groups_section: GroupSection,
}

impl Default for App {
    fn default() -> Self {
        Self {
            dark_mode: true,
            users_section: UsersSection::default(),
            groups_section: GroupSection::default(),
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

        // Update sections
        self.users_section.update(ctx);
        self.groups_section.update(ctx);

        // Theme Toggle Window - Top Left
        egui::Window::new("🎨 Theme")
            .default_pos([50.0, 50.0])
            .default_size([300.0, 200.0])
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

        // Users Window - Top Right
        egui::Window::new("👥 Users")
            .default_pos([400.0, 50.0])
            .default_size([400.0, 500.0])
            .show(ctx, |ui| {
                self.users_section.ui(ui);
            });

        // Groups Window - Bottom
        egui::Window::new("👥 Groups")
            .default_pos([50.0, 300.0])
            .default_size([500.0, 600.0])
            .show(ctx, |ui| {
                self.groups_section.ui(ui);
            });
    }
}
