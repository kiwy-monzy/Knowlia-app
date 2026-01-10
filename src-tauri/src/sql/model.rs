use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppData {
    pub pid: u32,
    pub process_name: String,
    pub is_focused: bool,
    pub focus_time: i64,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(default = "chrono::Utc::now")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    // from app_transitions
    pub total_focus_time: i64,
    // from latest windows_info
    pub window_id: Option<u32>,
    pub title: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowInfoData {
    pub window_id: u32,
    pub app_pid: u32,
    pub title: String,
    pub process_name: String,
    pub focus_time: i64,
    pub screenshot_url: String,
    pub llm_description: String,
    pub llm_keywords: String,
    pub llm_category: String,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub description_embedding: Vec<f32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppTransitionData {
    pub from_pid: u32,
    pub from_title: String,
    pub to_pid: u32,
    pub to_title: String,
    pub duration_since_last: u32,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GlobalConfig {
    pub use_same_model: String,
    pub vision_api_key: String,
    pub vision_base_url: String,
    pub vision_model: String,
    pub chat_api_key: String,
    pub chat_base_url: String,
    pub chat_model: String,
    pub enable_background_tasks: String,
    pub screenshot_delay: String,
    pub user_intention_delay: String,
    pub window_time_minutes: String,
    pub dashboard_stats_delay: String,
    pub app_path: String,
    pub enable_tools: String,
    pub sidebar_collapse: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIntentionHistory {
    pub id: Option<i64>,
    pub llm_user_intention: String,
    pub llm_user_state: String,
    pub llm_keywords: String,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub user_intention_embedding: Vec<f32>,
}

impl GlobalConfig {
    pub fn valid_keys() -> &'static [&'static str] {
        &[
            "use_same_model",
            "vision_api_key",
            "vision_base_url",
            "vision_model",
            "chat_api_key",
            "chat_base_url",
            "chat_model",
            "enable_background_tasks",
            "screenshot_delay",
            "user_intention_delay",
            "window_time_minutes",
            "dashboard_stats_delay",
            "app_path",
            "enable_tools",
            "sidebar_collapse",
        ]
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BanditStat {
    pub id: Option<i64>,
    pub user_state: String,
    pub reward: f32,
    pub to_assist: bool,
    pub user_action: String,
    #[serde(default = "chrono::Utc::now")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatSession {
    pub id: Option<i64>,
    pub title: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MessageData {
    pub id: Option<i64>,
    pub session_id: i64,
    pub role: String, // "user", "assistant", "system"
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowFocusData {
    pub window_id: u32,
    pub title: String,
    pub process_name: String,
    pub total_focus_time: i64,
    pub llm_description: String,
    pub llm_keywords: String,
    pub llm_category: String,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolData {
    pub server: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
}
