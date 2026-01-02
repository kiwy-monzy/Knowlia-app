use serde::{Deserialize, Serialize};
use std::str;
use tauri::State;
use dirs;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub due_date: Option<String>,
    pub subtasks: Vec<Subtask>,
    pub custom_fields: Vec<CustomField>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomField {
    pub id: String,
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskUpdate {
    pub id: String,
    pub status: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<Option<String>>,
    pub subtasks: Option<Vec<Subtask>>,
    pub custom_fields: Option<Vec<CustomField>>,
}

#[derive(Debug, thiserror::Error)]
pub enum TaskError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sled::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] bincode::Error),
    #[error("Task not found")]
    NotFound,
}

pub struct TaskStore {
    db: sled::Db,
}

impl TaskStore {
    pub fn new() -> Result<Self, TaskError> {
        // Get app data directory using dirs crate (matches Tauri's app data directory location)
        let app_data_dir = dirs::data_local_dir()
            .ok_or_else(|| TaskError::DatabaseError(sled::Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Failed to get app data directory",
            ))))?
            .join("com.tauri-app");
        
        // Ensure the app data directory exists
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| TaskError::DatabaseError(sled::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create app data directory: {}", e),
            ))))?;
        
        // Construct the database path
        let db_path = app_data_dir.join("task.knowlia");
        
        let db = sled::open(&db_path)?;
        Ok(Self { db })
    }

    pub fn create_task(&self, mut task: Task) -> Result<Task, TaskError> {
        if task.id.is_empty() {
            task.id = Uuid::new_v4().to_string();
        }
        if task.created_at.is_empty() {
            task.created_at = chrono::Utc::now().to_rfc3339();
        }
        
        let task_bytes = bincode::serialize(&task)?;
        self.db.insert(&task.id, task_bytes)?;
        Ok(task)
    }

    pub fn get_task(&self, id: &str) -> Result<Option<Task>, TaskError> {
        if let Some(task_bytes) = self.db.get(id)? {
            let task: Task = bincode::deserialize(&task_bytes)?;
            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    pub fn update_task(&self, id: &str, updates: TaskUpdate) -> Result<Task, TaskError> {
        let mut task = self.get_task(id)?.ok_or(TaskError::NotFound)?;

        if let Some(status) = updates.status {
            task.status = status;
        }
        if let Some(title) = updates.title {
            task.title = title;
        }
        if let Some(description) = updates.description {
            task.description = description;
        }
        if let Some(due_date) = updates.due_date {
            task.due_date = due_date;
        }
        if let Some(subtasks) = updates.subtasks {
            task.subtasks = subtasks;
        }
        if let Some(custom_fields) = updates.custom_fields {
            task.custom_fields = custom_fields;
        }

        let task_bytes = bincode::serialize(&task)?;
        self.db.insert(&task.id, task_bytes)?;
        
        Ok(task)
    }

    pub fn delete_task(&self, id: &str) -> Result<(), TaskError> {
        self.db.remove(id)?.ok_or(TaskError::NotFound)?;
        Ok(())
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, TaskError> {
        let mut tasks = Vec::new();
        
        for result in self.db.iter() {
            let (_, value) = result?;
            let task: Task = bincode::deserialize(&value)?;
            tasks.push(task);
        }
        
        Ok(tasks)
    }

    pub fn get_tasks_by_status(&self, status: &str) -> Result<Vec<Task>, TaskError> {
        let tasks = self.get_all_tasks()?;
        Ok(tasks.into_iter().filter(|t| t.status == status).collect())
    }
}

// Tauri Commands

#[tauri::command]
pub async fn create_task(state: State<'_, TaskStore>, task: Task) -> Result<Task, String> {
    state.create_task(task).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_task(state: State<'_, TaskStore>, id: String) -> Result<Option<Task>, String> {
    state.get_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, TaskStore>,
    id: String,
    updates: TaskUpdate,
) -> Result<Task, String> {
    state.update_task(&id, updates).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(state: State<'_, TaskStore>, id: String) -> Result<(), String> {
    state.delete_task(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_tasks(state: State<'_, TaskStore>) -> Result<Vec<Task>, String> {
    state.get_all_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tasks_by_status(
    state: State<'_, TaskStore>,
    status: String,
) -> Result<Vec<Task>, String> {
    state.get_tasks_by_status(&status).map_err(|e| e.to_string())
}

// Initialize the task store
pub fn init_task_store() -> Result<TaskStore, TaskError> {
    TaskStore::new()
}