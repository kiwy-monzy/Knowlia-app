use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::{Arc, Mutex};
use anyhow::Result;
use rusqlite::Connection;
use timetable_scrape;

#[derive(Debug, Serialize, Deserialize)]
pub struct TimetableSession {
    pub subject: String,
    pub location: String,
    pub start: String,
    pub end: String,
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(rename = "shortCode")]
    pub short_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimetableDay {
    pub day: String,
    pub sessions: Vec<TimetableSession>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimetableWeek {
    pub week: String,
    pub days: Vec<TimetableDay>,
}

// Database state for the application
pub struct DbState {
    pub db_path: Arc<Mutex<String>>,
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            db_path: Arc::new(Mutex::new("timetable.db".to_string())),
        }
    }
}

// Helper to open connection with proper config
fn open_db(path: &str) -> Result<Connection, String> {
    let conn = Connection::open(path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Enable WAL mode and set busy timeout
    let _ = conn.execute("PRAGMA journal_mode=WAL", []);
    let _ = conn.execute("PRAGMA busy_timeout=5000", []);
        
    Ok(conn)
}

// Initialize the database
#[tauri_crate::command]
pub async fn init_database(state: State<'_, DbState>) -> Result<String, String> {
    let path = state.db_path.lock().unwrap().clone();
    match open_db(&path) {
        Ok(conn) => {
            // Create events table if it doesn't exist
            if let Err(e) = conn.execute(
                "CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject TEXT NOT NULL,
                    location TEXT NOT NULL,
                    start TEXT NOT NULL,
                    end TEXT NOT NULL,
                    type TEXT NOT NULL,
                    short_code TEXT,
                    schedule_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            ) {
                return Err(format!("Failed to create events table: {}", e));
            }
            Ok("Database initialized successfully".to_string())
        }
        Err(e) => Err(e),
    }
}

// Fetch and process timetable data from API
#[tauri_crate::command]
pub async fn fetch_timetable_data(state: State<'_, DbState>) -> Result<TimetableWeek, String> {
    // Run the scraper in the background using the library
    if let Err(e) = timetable_scrape::run_background_scraper().await {
        eprintln!("Warning: Background scraper error: {}", e);
        // Continue even if scraper fails, try to use existing data
    }

    // Open connection from path in state
    let path = state.db_path.lock().unwrap().clone();
    let conn = open_db(&path)?;
    
    let mut days = Vec::new();
    let day_names = vec!["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    
    for day_name in day_names {
        let sessions = get_sessions_for_day(&conn, &day_name)?;
        days.push(TimetableDay {
            day: day_name.to_string(),
            sessions,
        });
    }
    
    Ok(TimetableWeek {
        week: "Current Week".to_string(),
        days,
    })
}

// Helper function to get sessions for a specific day
fn get_sessions_for_day(conn: &rusqlite::Connection, _day: &str) -> Result<Vec<TimetableSession>, String> {
    let mut sessions = Vec::new();
    
    // Query all events from the database
    let mut statement = conn.prepare("SELECT subject, location, start, end, type, short_code FROM events")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    
    let session_iter = statement.query_map([], |row| {
        Ok(TimetableSession {
            subject: row.get(0).unwrap_or_default(),
            location: row.get(1).unwrap_or_default(),
            start: row.get(2).unwrap_or_default(),
            end: row.get(3).unwrap_or_default(),
            event_type: row.get(4).unwrap_or_default(),
            short_code: row.get(5).unwrap_or(None),
        })
    }).map_err(|e| format!("Failed to execute query: {}", e))?;
    
    for session in session_iter {
        sessions.push(session.map_err(|e| format!("Failed to parse session: {}", e))?);
    }
    
    Ok(sessions)
}

// Get database statistics
#[tauri_crate::command]
pub async fn get_database_stats(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let path = state.db_path.lock().unwrap().clone();
    let conn = open_db(&path)?;
        
    let stats = serde_json::json!({
        "events": get_event_count(&conn).unwrap_or(0)
    });
    Ok(stats)
}

fn get_event_count(conn: &rusqlite::Connection) -> Result<i64, String> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM events",
        [],
        |row| row.get(0)
    ).map_err(|e| format!("Failed to count events: {}", e))?; 
    Ok(count)
}

// Get all events from database
#[tauri_crate::command]
pub async fn get_all_events(state: State<'_, DbState>) -> Result<Vec<TimetableSession>, String> {
    let path = state.db_path.lock().unwrap().clone();
    let conn = open_db(&path)?;
        
    get_sessions_for_day(&conn, "")
}

// Refresh timetable data
#[tauri_crate::command]
pub async fn refresh_timetable() -> Result<String, String> {
    // Run the scraper again to get fresh data
    match timetable_scrape::run_background_scraper().await {
        Ok(_) => Ok("Timetable data refreshed successfully".to_string()),
        Err(e) => Err(format!("Failed to refresh timetable data: {}", e)),
    }
}

// Scrape timetable data from API
#[tauri_crate::command]
pub async fn scrape_timetable_data() -> Result<Vec<serde_json::Value>, String> {
    use reqwest::Client;
    use futures::future::join_all;
    
    let client = Client::new();
    let mut tasks = Vec::new();

    for c in 'a'..='z' {
        let client = client.clone();
        let url = format!("https://udsm.iratiba.atomatiki.tech/api/v1/data/search/?q={}", c);
        tasks.push(tokio::spawn(async move {
            let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let json = resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
            Ok::<serde_json::Value, String>(json)
        }));
    }

    let mut results = Vec::new();
    let join_results = join_all(tasks).await;
    
    for join_res in join_results {
        match join_res {
            Ok(Ok(api_resp)) => results.push(api_resp),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task join error: {}", e)),
        }
    }

    Ok(results)
}

