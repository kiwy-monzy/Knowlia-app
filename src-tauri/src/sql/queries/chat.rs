use crate::sql::{convert_date_str_to_utc, error::DataError, get_conn, model::{MessageData, ChatSession}};

/// Insert a new chat session
pub fn insert_chat_session(title: String, system_prompt: &str) -> Result<i64, DataError> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO chat_sessions (
            title
        ) VALUES (?1)",
        rusqlite::params![&title],
    )?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO chat_messages (
            session_id,
            role,
            content
        ) VALUES (?1, ?2, ?3)",
        rusqlite::params![&id, "system", system_prompt],
    )?;

    Ok(id)
}

/// Inserts a new chat message into the database
pub fn insert_message(message: MessageData) -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO chat_messages (
            session_id,
            role,
            content
        ) VALUES (?1, ?2, ?3)",
        rusqlite::params![&message.session_id, &message.role, &message.content],
    )?;

    conn.execute(
        "UPDATE chat_sessions
         SET
            updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![message.session_id],
    )?;
    Ok(())
}

/// Get messages by session id
pub fn get_messages_by_session_id(session_id: i64) -> Result<Vec<MessageData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            id,
            role,
            content,
            created_at
         FROM chat_messages
         WHERE session_id = ?
         ORDER BY created_at ASC",
    )?;

    let chat_messages = stmt.query_map([session_id], |row| {
        let created_at_str: String = row.get(3)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        Ok(MessageData {
            id: Some(row.get(0)?),
            session_id,
            role: row.get(1)?,
            content: row.get(2)?,
            created_at,
        })
    })?;

    let mut messages = Vec::new();
    for message in chat_messages {
        messages.push(message?);
    }

    Ok(messages)
}

/// Get all chat sessions
pub fn get_all_chat_sessions() -> Result<Vec<ChatSession>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            id,
            title,
            created_at,
            updated_at
         FROM chat_sessions
         ORDER BY updated_at DESC",
    )?;

    let sessions = stmt.query_map([], |row| {
        let created_at_str: String = row.get(2)?;
        let updated_at_str: String = row.get(3)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        let updated_at = convert_date_str_to_utc(&updated_at_str)?;
        
        Ok(ChatSession {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at,
            updated_at,
        })
    })?;

    let mut result = Vec::new();
    for session in sessions {
        result.push(session?);
    }

    Ok(result)
}

/// Deletes messages by session id
pub fn delete_session_id(session_id: i64) -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "DELETE FROM chat_messages WHERE session_id = ?",
        [session_id],
    )?;
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", [session_id])?;

    Ok(())
}

/// Get all messages for a specific session
pub fn get_session_messages(session_id: i64) -> Result<Vec<MessageData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            id,
            session_id,
            role,
            content,
            created_at
         FROM chat_messages
         WHERE session_id = ?1
         ORDER BY created_at ASC",
    )?;

    let messages = stmt.query_map([session_id], |row| {
        let created_at_str: String = row.get(4)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        
        Ok(MessageData {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at
        })
    })?;

    let mut result = Vec::new();
    for message in messages {
        result.push(message?);
    }

    Ok(result)
}
