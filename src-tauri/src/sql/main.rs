use crate::{
    constants::{self, DB_POOL_SIZE, EMBEDDING_SIZE},
    sql::{error::DataError, model::GlobalConfig},
};
use once_cell::sync::OnceCell;
use rusqlite::{ffi::sqlite3_auto_extension, Connection};
use sqlite_vec::sqlite3_vec_init;
use std::fs;
use std::sync::mpsc;
use std::thread;
use std::{collections::HashMap, path::Path};
use tauri::{App, Manager};

// Database connection pool
pub struct DbPool {
    sender: mpsc::Sender<mpsc::Sender<Connection>>,
}

impl DbPool {
    fn new(db_path: &Path, pool_size: usize) -> Result<Self, DataError> {
        let (tx, rx): (
            mpsc::Sender<mpsc::Sender<Connection>>,
            mpsc::Receiver<mpsc::Sender<Connection>>,
        ) = mpsc::channel();

        let db_path = db_path.to_owned();
        thread::spawn(move || {
            let mut connections = Vec::new();

            // Create pool of connections
            for _ in 0..pool_size {
                unsafe {
                    sqlite3_auto_extension(Some(std::mem::transmute(
                        sqlite3_vec_init as *const (),
                    )));
                }

                match Connection::open(&db_path) {
                    Ok(conn) => {
                        // Configure connection for better concurrency
                        let _ = conn.pragma_update(None, "foreign_keys", "ON");
                        let _ = conn.pragma_update(None, "journal_mode", "WAL");
                        let _ = conn.pragma_update(None, "synchronous", "NORMAL");
                        let _ = conn.pragma_update(None, "cache_size", "1000");
                        let _ = conn.pragma_update(None, "temp_store", "MEMORY");
                        let _ = conn.pragma_update(None, "busy_timeout", "30000");
                        let _ = conn.pragma_update(None, "wal_autocheckpoint", "1000");
                        connections.push(conn);
                    }
                    Err(_) => continue,
                }
            }

            // Handle connection requests
            while let Ok(response_tx) = rx.recv() {
                if let Some(conn) = connections.pop() {
                    let _ = response_tx.send(conn);
                } else {
                    // Create new connection if pool is empty
                    unsafe {
                        sqlite3_auto_extension(Some(std::mem::transmute(
                            sqlite3_vec_init as *const (),
                        )));
                    }

                    if let Ok(conn) = Connection::open(&db_path) {
                        let _ = conn.pragma_update(None, "foreign_keys", "ON");
                        let _ = conn.pragma_update(None, "journal_mode", "WAL");
                        let _ = conn.pragma_update(None, "synchronous", "NORMAL");
                        let _ = conn.pragma_update(None, "cache_size", "1000");
                        let _ = conn.pragma_update(None, "temp_store", "MEMORY");
                        let _ = conn.pragma_update(None, "busy_timeout", "30000");
                        let _ = conn.pragma_update(None, "wal_autocheckpoint", "1000");
                        let _ = response_tx.send(conn);
                    }
                }
            }
        });

        Ok(DbPool { sender: tx })
    }

    fn get_connection(&self) -> Result<Connection, DataError> {
        let (tx, rx) = mpsc::channel();
        self.sender
            .send(tx)
            .map_err(|_| DataError::DatabaseError("Pool closed".to_string()))?;
        rx.recv()
            .map_err(|_| DataError::DatabaseError("Failed to get connection".to_string()))
    }
}

// A thread-safe, lazily-initialized database connection pool.
pub static DB_POOL: OnceCell<DbPool> = OnceCell::new();

/// Get a database connection from the pool
pub fn get_conn() -> Result<Connection, DataError> {
    match DB_POOL.get() {
        Some(pool) => pool.get_connection(),
        None => Err(DataError::DatabaseError("Pool not initialized".to_string())),
    }
}

pub fn init(app: &App) -> Result<(), DataError> {
    if DB_POOL.get().is_some() {
        return Ok(());
    }

    // Get the path to the app's data directory
    let app_data_dir = app.path().app_data_dir().unwrap();
    fs::create_dir_all(&app_data_dir).unwrap();

    let db_path = app_data_dir.join("sqlite.db");

    #[cfg(debug_assertions)]
    tracing::info!("Database path: {}", db_path.display());

    // Create a single connection first to set up the database schema
    unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(sqlite3_vec_init as *const ())));
    }
    let setup_conn = Connection::open(&db_path)?;
    setup_conn.pragma_update(None, "foreign_keys", "ON")?;
    setup_conn.pragma_update(None, "journal_mode", "WAL")?;
    setup_conn.pragma_update(None, "synchronous", "NORMAL")?;
    setup_conn.pragma_update(None, "busy_timeout", "30000")?;
    setup_database(&setup_conn, &app_data_dir)?;
    drop(setup_conn);

    let pool = DbPool::new(&db_path, DB_POOL_SIZE)?;

    DB_POOL
        .set(pool)
        .map_err(|_| DataError::DatabaseError("Pool already initialized".to_string()))?;

    Ok(())
}

fn setup_database(conn: &Connection, app_data_dir: &Path) -> Result<(), DataError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS apps (
            pid INTEGER PRIMARY KEY NOT NULL,
            focus_time INTEGER NOT NULL,
            process_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_focused BOOLEAN DEFAULT FALSE
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS windows_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_pid INTEGER NOT NULL,
            title TEXT NOT NULL,
            screenshot_data BLOB,
            llm_description TEXT,
            llm_keywords TEXT,
            llm_category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (app_pid) REFERENCES apps(pid)
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_transitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_pid INTEGER NOT NULL,
            from_title TEXT,
            to_pid INTEGER NOT NULL,
            to_title TEXT,
            duration_since_last INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_pid) REFERENCES apps(pid),
            FOREIGN KEY (to_pid) REFERENCES apps(pid)
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_intention_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            llm_user_intention TEXT NOT NULL,
            llm_user_state TEXT NOT NULL,
            llm_keywords TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        (),
    )?;

    // Chat session and message history
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS bandit_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_state TEXT NOT NULL,
            reward REAL NOT NULL,
            to_assist BOOLEAN NOT NULL,
            user_action TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        (),
    )?;

    // Create key-value store table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    // save app_path
    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params!["app_path", app_data_dir.to_str()],
    )?;

    // Create tools table, server and name are primary keys
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tools (
            server TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            enabled BOOLEAN DEFAULT TRUE,
            PRIMARY KEY (server, name)
        )",
        (),
    )?;

    /* EMBEDDINGS SUPPORT
     * Note: There are no support for foreign keys in sqlite-vec
     * https://github.com/asg017/sqlite-vec/blob/a2dd24f27ec7e4a5743e58f5ab6835deea5db58d/site/features/vec0.md
     */

    // WINDOWS INFO EMBEDDINGS
    conn.execute(
        format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS windows_info_embeddings USING vec0(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description_embedding float[{}],
            window_id INTEGER NOT NULL
            -- FOREIGN KEY (window_id) REFERENCES windows(id)
        )",
            EMBEDDING_SIZE
        )
        .as_str(),
        (),
    )?;

    // USER INTENTION EMBEDDINGS
    conn.execute(
        format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS user_intention_embeddings USING vec0(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_intention_embedding float[{}],
            user_intention_id INTEGER NOT NULL
        )",
            EMBEDDING_SIZE
        )
        .as_str(),
        (),
    )?;

    Ok(())
}

pub fn get_config() -> Result<GlobalConfig, DataError> {
    let conn = get_conn()?;

    let valid_keys = GlobalConfig::valid_keys();
    let placeholders = valid_keys.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!(
        "SELECT key, value FROM kv_store WHERE key IN ({})",
        placeholders
    );

    // Get only valid config values in a single query
    let mut stmt = conn.prepare(&query)?;
    let config_iter = stmt.query_map(rusqlite::params_from_iter(valid_keys.iter()), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut config_map: HashMap<String, String> = HashMap::new();
    for item in config_iter {
        let (key, value) = item?;
        config_map.insert(key, value);
    }

    let get_value = |key: &str, default: &str| -> String {
        let value = config_map.get(key).cloned().unwrap_or(default.to_string());
        if value.is_empty() {
            default.to_string()
        } else {
            value
        }
    };

    Ok(GlobalConfig {
        use_same_model: get_value("use_same_model", "true"),
        vision_api_key: get_value("vision_api_key", "None"),
        vision_base_url: get_value("vision_base_url", &constants::VISION_BASE_URL),
        vision_model: get_value("vision_model", &constants::VISION_MODEL_NAME),
        chat_api_key: get_value("chat_api_key", "None"),
        chat_base_url: get_value("chat_base_url", &constants::CHAT_BASE_URL),
        chat_model: get_value("chat_model", &constants::CHAT_MODEL_NAME),
        enable_background_tasks: get_value("enable_background_tasks", "true"),
        screenshot_delay: get_value("screenshot_delay", "5"),
        user_intention_delay: get_value("user_intention_delay", "5"),
        window_time_minutes: get_value("window_time_minutes", "5"),
        dashboard_stats_delay: get_value("dashboard_stats_delay", "30"),
        app_path: get_value("app_path", ""),
        enable_tools: get_value("enable_tools", "false"),
        sidebar_collapse: get_value("sidebar_collapse", "false"),
    })
}

/// Set the value of a config key
pub fn set_config_value(key: &str, value: &str) -> Result<(), DataError> {
    let valid_keys = GlobalConfig::valid_keys();

    if !valid_keys.contains(&key) {
        return Err(DataError::InvalidKey(format!(
            "Invalid config key '{}'. Valid keys are: {}",
            key,
            valid_keys.join(", ")
        )));
    }

    let conn = get_conn()?;

    conn.execute(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )?;

    Ok(())
}
