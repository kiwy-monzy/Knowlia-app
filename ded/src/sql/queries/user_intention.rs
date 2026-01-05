use crate::sql::{
    convert_date_str_to_utc, error::DataError, get_conn, model::UserIntentionHistory,
};

use rusqlite::params;
use zerocopy::IntoBytes;

/// Saves user intention history to database
pub fn save_user_intention_history(
    intention_data: &UserIntentionHistory,
) -> Result<i64, DataError> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO user_intention_history (
            llm_user_intention,
            llm_user_state,
            llm_keywords,
            created_at)
        VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            &intention_data.llm_user_intention,
            &intention_data.llm_user_state,
            &intention_data.llm_keywords,
            intention_data
                .created_at
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        ],
    )?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO user_intention_embeddings (user_intention_id, user_intention_embedding)
        VALUES (?1, ?2)",
        rusqlite::params![id, &intention_data.user_intention_embedding.as_bytes()],
    )?;

    Ok(id)
}

/// Gets recent user intention history
pub fn get_recent_user_intentions(
    limit: u32,
    time_window_minutes: i64,
) -> Result<Vec<UserIntentionHistory>, DataError> {
    let conn = get_conn()?;

    let now = chrono::Utc::now();
    let hours_ago = now - chrono::Duration::minutes(time_window_minutes);

    let mut stmt = conn.prepare(
        "SELECT
            uih.id,
            llm_user_intention,
            llm_user_state,
            llm_keywords,
            uih.created_at,
            uie.user_intention_embedding
         FROM user_intention_history uih
         LEFT JOIN user_intention_embeddings uie ON uih.id = uie.user_intention_id
         WHERE uih.created_at >= ?1
         ORDER BY uih.created_at DESC
         LIMIT ?2",
    )?;

    let intentions_iter = stmt.query_map(
        params![hours_ago.format("%Y-%m-%d %H:%M:%S").to_string(), limit],
        |row| {
            let created_at_str: String = row.get(4)?;
            let created_at = convert_date_str_to_utc(&created_at_str)?;
            let user_intention_embedding_raw: Vec<_> = row.get(5)?;
            let user_intention_embedding = user_intention_embedding_raw
                .iter()
                .map(|&e| e as f32)
                .collect();
            Ok(UserIntentionHistory {
                id: Some(row.get(0)?),
                llm_user_intention: row.get(1)?,
                llm_user_state: row.get(2)?,
                llm_keywords: row.get(3)?,
                created_at,
                user_intention_embedding,
            })
        },
    )?;

    let mut intentions = Vec::new();
    for intention in intentions_iter {
        intentions.push(intention?);
    }

    Ok(intentions)
}

/// Gets user intention by id
pub fn get_user_intention_by_id(id: i64) -> Result<UserIntentionHistory, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            uih.id,
            llm_user_intention,
            llm_user_state,
            llm_keywords,
            uih.created_at,
            uie.user_intention_embedding
         FROM user_intention_history uih
         LEFT JOIN user_intention_embeddings uie ON uih.id = uie.user_intention_id
         WHERE uih.id = ?
         LIMIT 1",
    )?;

    let intention = stmt.query_row([id], |row| {
        let created_at_str: String = row.get(4)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        let user_intention_embedding_raw: Vec<_> = row.get(5)?;
        let user_intention_embedding = user_intention_embedding_raw
            .iter()
            .map(|&e| e as f32)
            .collect();
        Ok(UserIntentionHistory {
            id: Some(row.get(0)?),
            llm_user_intention: row.get(1)?,
            llm_user_state: row.get(2)?,
            llm_keywords: row.get(3)?,
            created_at,
            user_intention_embedding,
        })
    })?;

    Ok(intention)
}

/// Semantic search over user intentions
pub fn search_user_intentions(
    query_embedding: Vec<f32>,
    limit: u32,
    hours_ago: u32,
) -> Result<Vec<UserIntentionHistory>, DataError> {
    let conn = get_conn()?;

    let now = chrono::Utc::now();
    let hours_ago = now - chrono::Duration::hours(hours_ago as i64);

    let mut stmt = conn.prepare(
        "SELECT
            uih.id,
            llm_user_intention,
            llm_user_state,
            llm_keywords,
            uih.created_at,
            uie.user_intention_embedding,
            distance
         FROM user_intention_embeddings uie
         INNER JOIN user_intention_history uih ON uih.id = uie.user_intention_id
         WHERE uie.user_intention_embedding match ?1 AND k = ?2 AND uih.created_at > ?3
         ORDER BY distance ASC",
    )?;

    let intentions_iter = stmt.query_map(
        params![
            query_embedding.as_bytes(),
            limit,
            hours_ago.format("%Y-%m-%d %H:%M:%S").to_string()
        ],
        |row| {
            let created_at_str: String = row.get(4)?;
            let created_at = convert_date_str_to_utc(&created_at_str)?;
            let user_intention_embedding_raw: Vec<_> = row.get(5)?;
            let user_intention_embedding = user_intention_embedding_raw
                .iter()
                .map(|&e| e as f32)
                .collect();
            Ok(UserIntentionHistory {
                id: Some(row.get(0)?),
                llm_user_intention: row.get(1)?,
                llm_user_state: row.get(2)?,
                llm_keywords: row.get(3)?,
                created_at,
                user_intention_embedding,
            })
        },
    )?;

    let mut intentions = Vec::new();
    for intention in intentions_iter {
        intentions.push(intention?);
    }

    Ok(intentions)
}
