use std::collections::HashMap;

use crate::sql::{
    convert_date_str_to_utc,
    error::DataError,
    get_config, get_conn,
    model::{AppData, AppTransitionData, WindowFocusData, WindowInfoData},
};
use chrono::{DateTime, Duration, TimeZone, Utc};
use rusqlite::{params, Connection};

use zerocopy::IntoBytes;

/// Add a new app record to the database
pub fn add_app(
    pid: u32,
    process_name: &str,
    title: &str,
    no_insert: bool,
) -> Result<u32, DataError> {
    if pid == 0 {
        return Err(DataError::InvalidPid(0));
    }

    if no_insert {
        return Ok(1);
    }

    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO apps (pid, process_name, focus_time)
        VALUES (?1, ?2, ?3) ON CONFLICT(pid) DO NOTHING",
        rusqlite::params![pid, process_name, 1],
    )?;

    let now = chrono::Utc::now();

    let latest_app = get_currently_focused_app(Some(&conn));
    match latest_app {
        Ok(prev_app) => {
            let prev_pid = prev_app.pid;
            let time_delta = (now - prev_app.updated_at).as_seconds_f64().round() as i64;
            if prev_pid == pid {
                conn.execute(
                    "UPDATE apps
                     SET
                        focus_time = focus_time + ?1,
                        updated_at = datetime('now'),
                        is_focused = TRUE
                     WHERE pid = ?2",
                    rusqlite::params![time_delta, pid],
                )?;

                if let Some(prev_title) = prev_app.title {
                    if prev_title != title {
                        conn.execute(
                            "
                            INSERT INTO app_transitions (from_pid, from_title, to_pid, to_title, duration_since_last)
                            VALUES (?1, ?2, ?3, ?4, ?5)",
                            rusqlite::params![prev_app.pid, prev_title, pid, title, time_delta],
                        )?;

                        // TODO: This constantly changes the app's focus time. We need a way to categorize the app by title
                        // For now, we'll restart the focus time
                        conn.execute(
                            "
                            UPDATE apps
                            SET
                                focus_time = ?1,
                                updated_at = datetime('now'),
                                is_focused = TRUE
                            WHERE pid = ?2",
                            rusqlite::params![time_delta, pid],
                        )?;

                        #[cfg(debug_assertions)]
                        tracing::debug!(
                            "From {} ({}) -> To {} ({})",
                            prev_pid,
                            prev_title,
                            pid,
                            title
                        );
                    }
                }
            } else {
                // transition to new app
                conn.execute(
                    "
                    INSERT INTO app_transitions (from_pid, from_title, to_pid, to_title, duration_since_last)
                    VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![prev_app.pid, prev_app.title, pid, title, time_delta + &prev_app.focus_time],
                )?;

                conn.execute(
                    "UPDATE apps
                     SET
                        focus_time = 0,
                        is_focused = FALSE
                     WHERE pid = ?1",
                    rusqlite::params![prev_app.pid],
                )?;

                conn.execute(
                    "UPDATE apps
                     SET
                        focus_time = 0,
                        updated_at = datetime('now'),
                        is_focused = TRUE
                     WHERE pid = ?1",
                    rusqlite::params![pid],
                )?;

                tracing::debug!("Transition from {} to {}", prev_app.pid, pid);
            }
        }
        Err(e) => {
            tracing::debug!("Error {}", e);

            // No previously focused app, this is the first app
            conn.execute(
                "UPDATE apps
                 SET
                    focus_time = 0,
                    updated_at = datetime('now'),
                    is_focused = TRUE
                 WHERE pid = ?1",
                rusqlite::params![pid],
            )?;

            conn.execute(
                "UPDATE apps
                 SET
                    focus_time = 0,
                    is_focused = FALSE
                 WHERE pid != ?1",
                rusqlite::params![pid],
            )?;
        }
    }

    Ok(pid)
}

/// Update the LLM summary for a given window ID
pub fn update_llm_window_info(window: WindowInfoData) -> Result<(), DataError> {
    let conn = get_conn()?;

    let screenshot_data = crate::helpers::compress_string(&window.screenshot_url).ok();

    conn.execute(
        "INSERT INTO windows_info (
            title,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &window.title,
            &window.app_pid,
            screenshot_data,
            &window.llm_description,
            &window.llm_keywords,
            &window.llm_category
        ],
    )?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO windows_info_embeddings (window_id, description_embedding)
        VALUES (?1, ?2)",
        rusqlite::params![id, &window.description_embedding.as_bytes()],
    )?;
    Ok(())
}

/// Delete all rows created before time seconds
pub fn delete_windows_info_older_than(seconds: i64) -> Result<(), DataError> {
    let conn = get_conn()?;

    let date = Utc::now().timestamp() - seconds;
    let date_time = Utc.timestamp_opt(date as i64, 0).unwrap();
    let date_time_str = date_time.format("%Y-%m-%d %H:%M:%S").to_string();

    tracing::info!("Deleting windows info older than {}", date_time);

    let mut stmt = conn.prepare("DELETE FROM windows_info WHERE created_at < ?1 RETURNING id")?;
    let deleted_window_ids: Vec<i64> = stmt
        .query_map(rusqlite::params![date_time_str], |row| row.get(0))?
        .collect::<Result<Vec<i64>, _>>()?;

    conn.execute(
        "DELETE FROM app_transitions WHERE created_at < ?",
        rusqlite::params![date_time_str],
    )?;

    // apps must be deleted after windows_info and app_transitions
    conn.execute(
        "DELETE FROM apps WHERE created_at < ?",
        rusqlite::params![date_time_str],
    )?;

    // Only proceed if there are IDs to delete
    if !deleted_window_ids.is_empty() {
        let placeholders = vec!["?"; deleted_window_ids.len()].join(",");
        let sql = format!(
            "DELETE FROM windows_info_embeddings WHERE window_id IN ({})",
            placeholders
        );
        conn.execute(&sql, rusqlite::params_from_iter(&deleted_window_ids))?;
    }

    conn.execute(
        "UPDATE apps
         SET
            focus_time = 0,
            updated_at = datetime('now'),
            is_focused = FALSE
         WHERE is_focused = TRUE",
        rusqlite::params![],
    )?;

    Ok(())
}

/// Unfocus the current app
pub fn unfocus_current_app() -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE apps
         SET
            focus_time = 0,
            updated_at = datetime('now'),
            is_focused = FALSE
         WHERE is_focused = TRUE",
        rusqlite::params![],
    )?;

    Ok(())
}

/// Get WindowInfoData from a given window ID
pub fn get_window_info_by_pid(pid: u32, limit: u32) -> Result<Vec<WindowInfoData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            wi.id,
            title,
            a.process_name,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category,
            a.focus_time,
            wi.created_at,
            wie.description_embedding
         FROM windows_info wi
         JOIN apps a ON wi.app_pid = a.pid
         LEFT JOIN windows_info_embeddings wie ON wi.id = wie.window_id
         WHERE app_pid = ?
         ORDER BY wi.created_at DESC
         LIMIT ?",
    )?;

    let window_info_data_iter = stmt.query_map([pid, limit], |row| {
        let created_at_str: String = row.get(9)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        let screenshot_data: Option<Vec<u8>> = row.get(4)?;
        let screenshot_url: String = screenshot_data
            .as_ref()
            .and_then(|data| crate::helpers::decompress_string(data).ok())
            .unwrap_or("".to_string());
        let description_embedding_raw: Vec<_> = row.get(10)?;
        let description_embedding = description_embedding_raw
            .iter()
            .map(|&e| e as f32)
            .collect();
        Ok(WindowInfoData {
            window_id: row.get(0)?,
            title: row.get(1)?,
            process_name: row.get(2)?,
            app_pid: row.get(3)?,
            screenshot_url,
            llm_description: row.get(5)?,
            llm_keywords: row.get(6)?,
            llm_category: row.get(7)?,
            focus_time: row.get(8)?,
            created_at,
            description_embedding,
        })
    })?;

    let mut window_info_data = Vec::new();
    for window_info in window_info_data_iter {
        window_info_data.push(window_info?);
    }

    Ok(window_info_data)
}

pub fn get_window_info_by_pid_in_time_range(
    pid: u32,
    limit: u32,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
) -> Result<Vec<WindowInfoData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            wi.id,
            wi.title,
            a.process_name,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category,
            a.focus_time,
            wi.created_at,
            wie.description_embedding
         FROM windows_info wi
         JOIN apps a ON wi.app_pid = a.pid
         LEFT JOIN windows_info_embeddings wie ON wi.id = wie.window_id
         WHERE app_pid = ? AND wi.created_at BETWEEN ? AND ?
         ORDER BY wi.created_at DESC
         LIMIT ?",
    )?;

    let start_time_str = start_time.format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let end_time_str = end_time.format("%Y-%m-%d %H:%M:%S%.3f").to_string();

    let window_info_data_iter = stmt.query_map(
        [
            pid.to_string(),
            start_time_str,
            end_time_str,
            limit.to_string(),
        ],
        |row| {
            let created_at_str: String = row.get(9)?;
            let created_at = convert_date_str_to_utc(&created_at_str)?;
            let screenshot_data: Option<Vec<u8>> = row.get(4)?;
            let screenshot_url: String = screenshot_data
                .as_ref()
                .and_then(|data| crate::helpers::decompress_string(data).ok())
                .unwrap_or("".to_string());
            let description_embedding_raw: Vec<_> = row.get(10)?;
            let description_embedding = description_embedding_raw
                .iter()
                .map(|&e| e as f32)
                .collect();
            Ok(WindowInfoData {
                window_id: row.get(0)?,
                title: row.get(1)?,
                process_name: row.get(2)?,
                app_pid: row.get(3)?,
                screenshot_url,
                llm_description: row.get(5)?,
                llm_keywords: row.get(6)?,
                llm_category: row.get(7)?,
                focus_time: row.get(8)?,
                created_at,
                description_embedding,
            })
        },
    )?;

    let mut window_info_data = Vec::new();
    for window_info in window_info_data_iter {
        window_info_data.push(window_info?);
    }

    Ok(window_info_data)
}

/// Get all apps in a time window
pub fn get_apps_in_time_window(
    conn: Option<&Connection>,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
) -> Result<Vec<AppData>, DataError> {
    let owned_conn;
    let conn = match conn {
        Some(c) => c,
        None => {
            owned_conn = get_conn()?;
            &owned_conn
        }
    };

    let mut stmt = conn.prepare(
        "WITH transition_sums AS (
            SELECT
                at.from_pid AS app_pid,
                SUM(COALESCE(at.duration_since_last, 0)) AS focus_time
            FROM app_transitions at
            WHERE at.created_at BETWEEN ?1 AND ?2
            GROUP BY at.from_pid
        ),
        latest_metadata AS (
            SELECT *
            FROM (
                SELECT
                    wi.id,
                    wi.title,
                    wi.app_pid,
                    wi.llm_description,
                    wi.llm_keywords,
                    wi.llm_category,
                    wi.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY wi.app_pid
                        ORDER BY wi.created_at DESC
                    ) AS rn
                FROM windows_info wi
                WHERE wi.created_at BETWEEN ?1 AND ?2
            )
            WHERE rn = 1
        )

        SELECT
           	a.pid,
           	a.process_name,
           	a.focus_time,
            ts.focus_time AS total_focus_time,
           	a.created_at,
           	a.updated_at,
            a.is_focused,
            lm.id,
            lm.title,
            lm.llm_category AS category,
            lm.llm_description AS description
         FROM apps a
         LEFT JOIN transition_sums ts ON a.pid = ts.app_pid
         LEFT JOIN latest_metadata lm ON a.pid = lm.app_pid
         ORDER BY a.created_at ASC",
    )?;

    let start_str = start_time.format("%Y-%m-%d %H:%M:%S").to_string();
    let end_str = end_time.format("%Y-%m-%d %H:%M:%S").to_string();

    let app_data_iter = stmt.query_map([start_str, end_str], |row| {
        let focus_time: i64 = row.get(2)?;
        let total_focus_time: i64 = row.get(3).unwrap_or(0);
        let created_at_str: String = row.get(4)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        let updated_at_str: String = row.get(5)?;
        let updated_at = convert_date_str_to_utc(&updated_at_str)?;
        Ok(AppData {
            pid: row.get(0)?,
            process_name: row.get(1)?,
            focus_time,
            total_focus_time: focus_time + total_focus_time,
            created_at,
            updated_at,
            is_focused: row.get(6)?,
            window_id: row.get(7)?,
            title: row.get(8)?,
            category: row.get(9)?,
            description: row.get(10)?,
        })
    })?;

    let mut apps = Vec::new();
    for app_data in app_data_iter {
        apps.push(app_data?);
    }

    Ok(apps)
}

/// Get the currently focused app data.
pub fn get_currently_focused_app(conn: Option<&Connection>) -> Result<AppData, DataError> {
    let config = get_config()?;
    let end_time = Utc::now() + Duration::minutes(5);

    // Use a window time equivalent to the user intention delay
    let start_time = end_time - Duration::minutes(config.user_intention_delay.parse().unwrap());

    let apps_data = get_apps_in_time_window(conn, start_time, end_time)?;

    if let Some(focused_app) = apps_data.iter().find(|app| app.is_focused) {
        Ok(focused_app.clone())
    } else {
        Err(DataError::NotFound)
    }
}

/// Gets app transitions within a time window
pub fn get_transitions_in_time_window(
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
) -> Result<Vec<AppTransitionData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            from_pid,
            from_title,
            to_pid,
            to_title,
            duration_since_last,
            created_at
         FROM app_transitions
         WHERE created_at BETWEEN ?1 AND ?2
         ORDER BY created_at ASC",
    )?;

    let start_str = start_time.format("%Y-%m-%d %H:%M:%S").to_string();
    let end_str = end_time.format("%Y-%m-%d %H:%M:%S").to_string();

    let transitions_iter = stmt.query_map([start_str, end_str], |row| {
        let created_at_str: String = row.get(5)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        Ok(AppTransitionData {
            from_pid: row.get(0)?,
            from_title: row.get(1)?,
            to_pid: row.get(2)?,
            to_title: row.get(3)?,
            duration_since_last: row.get(4)?,
            created_at,
        })
    })?;

    let mut transitions = Vec::new();
    for transition in transitions_iter {
        transitions.push(transition?);
    }

    Ok(transitions)
}

/// Gets the most recent window info for a PID near a specific time
pub fn get_window_info_near_time(
    pid: u32,
    target_time: DateTime<Utc>,
    tolerance_minutes: i32,
) -> Result<WindowInfoData, DataError> {
    let conn = get_conn()?;

    let start_time = target_time - chrono::Duration::minutes(tolerance_minutes as i64);
    let end_time = target_time + chrono::Duration::minutes(tolerance_minutes as i64);

    let mut stmt = conn.prepare(
        "SELECT
            wi.id,
            wi.title,
            a.process_name,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category,
            a.focus_time,
            wi.created_at,
            wie.description_embedding
         FROM windows_info wi
         JOIN apps a ON wi.app_pid = a.pid
         LEFT JOIN windows_info_embeddings wie ON wi.id = wie.window_id
         WHERE app_pid = ?1
         AND wi.created_at BETWEEN ?2 AND ?3
         ORDER BY wi.created_at DESC
         LIMIT 1",
    )?;

    let start_str = start_time.format("%Y-%m-%d %H:%M:%S").to_string();
    let end_str = end_time.format("%Y-%m-%d %H:%M:%S").to_string();

    let window_info = stmt.query_row([pid.to_string(), start_str, end_str], |row| {
        let created_at_str: String = row.get(9)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        let screenshot_data: Option<Vec<u8>> = row.get(4)?;
        let screenshot_url: String = screenshot_data
            .as_ref()
            .and_then(|data| crate::helpers::decompress_string(data).ok())
            .unwrap_or("".to_string());
        let description_embedding_raw: Vec<_> = row.get(10)?;
        let description_embedding = description_embedding_raw
            .iter()
            .map(|&e| e as f32)
            .collect();

        Ok(WindowInfoData {
            window_id: row.get(0)?,
            title: row.get(1)?,
            process_name: row.get(2)?,
            app_pid: row.get(3)?,
            screenshot_url,
            llm_description: row.get(5)?,
            llm_keywords: row.get(6)?,
            llm_category: row.get(7)?,
            focus_time: row.get(8)?,
            created_at,
            description_embedding,
        })
    })?;

    Ok(window_info)
}

/// Semantic search over window info.
pub fn search_window_info(
    query_embedding: Vec<f32>,
    limit: u32,
    hours_ago: u32,
) -> Result<Vec<WindowInfoData>, DataError> {
    let conn = get_conn()?;

    let now = chrono::Utc::now();
    let hours_ago = now - chrono::Duration::hours(hours_ago as i64);

    let mut stmt = conn.prepare(
        "SELECT
            wi.id,
            wi.title,
            a.process_name,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category,
            a.focus_time,
            wi.created_at,
            wie.description_embedding,
            distance
         FROM windows_info_embeddings wie
         INNER JOIN windows_info wi ON wi.id = wie.window_id
         JOIN apps a ON wi.app_pid = a.pid
         WHERE wie.description_embedding match ?1 AND k = ?2 AND wi.created_at > ?3
         ORDER BY distance ASC",
    )?;

    let window_info_data_iter = stmt.query_map(
        params![
            query_embedding.as_bytes(),
            limit,
            hours_ago.format("%Y-%m-%d %H:%M:%S").to_string()
        ],
        |row| {
            let created_at_str: String = row.get(9)?;
            let created_at = convert_date_str_to_utc(&created_at_str)?;
            let screenshot_data: Option<Vec<u8>> = row.get(4)?;
            let screenshot_url: String = screenshot_data
                .as_ref()
                .and_then(|data| crate::helpers::decompress_string(data).ok())
                .unwrap_or("".to_string());
            let description_embedding_raw: Vec<_> = row.get(10)?;
            let description_embedding = description_embedding_raw
                .iter()
                .map(|&e| e as f32)
                .collect();
            Ok(WindowInfoData {
                window_id: row.get(0)?,
                title: row.get(1)?,
                process_name: row.get(2)?,
                app_pid: row.get(3)?,
                screenshot_url,
                llm_description: row.get(5)?,
                llm_keywords: row.get(6)?,
                llm_category: row.get(7)?,
                focus_time: row.get(8)?,
                created_at,
                description_embedding,
            })
        },
    )?;

    let mut window_info_data = Vec::new();
    for window_info in window_info_data_iter {
        window_info_data.push(window_info?);
    }

    Ok(window_info_data)
}

/// Semantic search over window info, grouped by process_name
///
/// After running the cosine similarity, it returns the top-3 with
/// the smallest cosine distance for each process_name.
pub fn search_window_info_by_process_name(
    query_embedding: Vec<f32>,
    limit: u32,
    hours_ago: u32,
) -> Result<HashMap<String, Vec<WindowInfoData>>, DataError> {
    let conn = get_conn()?;

    let now = chrono::Utc::now();
    let hours_ago = now - chrono::Duration::hours(hours_ago as i64);

    let mut stmt = conn.prepare(
        "WITH results AS (
            SELECT
                wi.id,
                wi.title,
                a.process_name,
                wi.app_pid,
                wi.screenshot_data,
                wi.llm_description,
                wi.llm_keywords,
                wi.llm_category,
                a.focus_time,
                wi.created_at,
                wie.description_embedding,
                wie.distance
            FROM windows_info_embeddings wie
            INNER JOIN windows_info wi ON wi.id = wie.window_id
            JOIN apps a ON wi.app_pid = a.pid
            WHERE wie.description_embedding MATCH ?1
              AND k = ?2
              AND wi.created_at > ?3
        ),
        ranked AS (
            SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY process_name ORDER BY distance ASC) AS rn
            FROM results
        )
        SELECT
            id,
            title,
            process_name,
            app_pid,
            screenshot_data,
            llm_description,
            llm_keywords,
            llm_category,
            focus_time,
            created_at,
            description_embedding,
            distance
        FROM ranked
        WHERE rn <= 3
        ORDER BY distance ASC;
",
    )?;

    let window_info_data_iter = stmt.query_map(
        params![
            query_embedding.as_bytes(),
            limit,
            hours_ago.format("%Y-%m-%d %H:%M:%S").to_string()
        ],
        |row| {
            let created_at_str: String = row.get(9)?;
            let created_at = convert_date_str_to_utc(&created_at_str)?;
            let screenshot_data: Option<Vec<u8>> = row.get(4)?;
            let screenshot_url: String = screenshot_data
                .as_ref()
                .and_then(|data| crate::helpers::decompress_string(data).ok())
                .unwrap_or("".to_string());
            let description_embedding_raw: Vec<_> = row.get(10)?;
            let description_embedding = description_embedding_raw
                .iter()
                .map(|&e| e as f32)
                .collect();
            Ok(WindowInfoData {
                window_id: row.get(0)?,
                title: row.get(1)?,
                process_name: row.get(2)?,
                app_pid: row.get(3)?,
                screenshot_url,
                llm_description: row.get(5)?,
                llm_keywords: row.get(6)?,
                llm_category: row.get(7)?,
                focus_time: row.get(8)?,
                created_at,
                description_embedding,
            })
        },
    )?;

    let mut window_info_data: HashMap<String, Vec<WindowInfoData>> = HashMap::new();
    for window_info in window_info_data_iter {
        let window_info = window_info?;
        if window_info_data.contains_key(&window_info.process_name) {
            window_info_data
                .get_mut(&window_info.process_name)
                .unwrap()
                .push(window_info);
        } else {
            window_info_data.insert(window_info.process_name.clone(), vec![window_info]);
        }
    }

    Ok(window_info_data)
}

/// Get all windows info in a time window grouped by title with focus time calculated from transitions
pub fn get_windows_focus_by_title(
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
) -> Result<Vec<WindowFocusData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "WITH transition_sums AS (
            SELECT
                at.from_pid AS app_pid,
                at.from_title AS window_title,
                SUM(COALESCE(at.duration_since_last, 0)) AS focus_time
            FROM app_transitions at
            WHERE at.created_at BETWEEN ?1 AND ?2
            GROUP BY at.from_pid, at.from_title
        ),
        latest_metadata AS (
            SELECT *
            FROM (
                SELECT
                    wi.id,
                    wi.title,
                    wi.app_pid,
                    wi.llm_description,
                    wi.llm_keywords,
                    wi.llm_category,
                    wi.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY wi.title, wi.app_pid
                        ORDER BY wi.created_at DESC
                    ) AS rn
                FROM windows_info wi
                WHERE wi.created_at BETWEEN ?1 AND ?2
            )
            WHERE rn = 1
        )
        SELECT
            lm.id,
            lm.title,
            a.process_name,
            ts.focus_time AS total_focus_time,
            lm.llm_description,
            lm.llm_keywords,
            lm.llm_category,
            lm.created_at AS last_seen
        FROM latest_metadata lm
        JOIN apps a ON lm.app_pid = a.pid
        JOIN transition_sums ts ON lm.app_pid = ts.app_pid AND lm.title = ts.window_title
        WHERE ts.focus_time > 15
        ORDER BY last_seen",
    )?;

    let start_str = start_time.format("%Y-%m-%d %H:%M:%S").to_string();
    let end_str = end_time.format("%Y-%m-%d %H:%M:%S").to_string();

    let focus_data_iter = stmt.query_map([start_str, end_str], |row| {
        let last_seen_str: String = row.get(7)?;
        let last_seen = convert_date_str_to_utc(&last_seen_str)?;

        Ok(WindowFocusData {
            window_id: row.get(0)?,
            title: row.get(1)?,
            process_name: row.get(2)?,
            total_focus_time: row.get(3)?,
            llm_description: row.get(4)?,
            llm_keywords: row.get(5)?,
            llm_category: row.get(6)?,
            last_seen,
        })
    })?;

    let mut focus_data = Vec::new();
    for data in focus_data_iter {
        focus_data.push(data?);
    }

    Ok(focus_data)
}

/// Get screenshot_url based on window id
pub fn get_screenshot_url(window_id: u32) -> Result<String, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            screenshot_data
         FROM windows_info wi
         WHERE wi.id = ?1",
    )?;

    let screenshot_url = match stmt.query_row([window_id], |row| {
        let screenshot_data: Option<Vec<u8>> = row.get(0)?;
        let screenshot_url: String = screenshot_data
            .as_ref()
            .and_then(|data| crate::helpers::decompress_string(data).ok())
            .unwrap_or(String::new());
        Ok(screenshot_url)
    }) {
        Ok(screenshot_url) => screenshot_url,
        Err(_) => String::new(),
    };

    Ok(screenshot_url)
}
