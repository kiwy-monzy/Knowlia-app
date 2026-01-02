use crate::{
    llm::model::Tool,
    sql::{error::DataError, get_conn, model::ToolData},
};

/// Insert a new chat session
pub fn insert_tools(server: String, tools: Vec<rmcp::model::Tool>) -> Result<i64, DataError> {
    let conn = get_conn()?;

    for tool in tools {
        conn.execute(
            "INSERT INTO tools (
                server,
                name,
                description
            ) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING",
            rusqlite::params![&server, &tool.name, &tool.description],
        )?;
    }

    let id = conn.last_insert_rowid();

    Ok(id)
}

pub fn update_local_tools(tools: Vec<Tool>) -> Result<i64, DataError> {
    let conn = get_conn()?;

    // Build a list of tool names from the provided tools
    let tool_names: Vec<String> = tools.iter().map(|t| t.function.name.clone()).collect();

    if !tool_names.is_empty() {
        // Build placeholders like (?, ?, ?, ...)
        let placeholders = tool_names
            .iter()
            .map(|_| "?".to_string())
            .collect::<Vec<_>>()
            .join(", ");

        // Delete local tools NOT in the new list
        let mut stmt = conn.prepare(&format!(
            "DELETE FROM tools WHERE server = '_local' AND name NOT IN ({})",
            placeholders
        ))?;

        let params: Vec<&dyn rusqlite::ToSql> = tool_names
            .iter()
            .map(|n| n as &dyn rusqlite::ToSql)
            .collect();
        stmt.execute(rusqlite::params_from_iter(params))?;
    } else {
        // If no tools provided, remove all local ones
        conn.execute("DELETE FROM tools WHERE server = '_local'", ())?;
    }

    // Insert (or keep) the current ones
    for tool in tools {
        conn.execute(
            "INSERT INTO tools (server, name, description)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(server, name) DO UPDATE SET description = excluded.description",
            rusqlite::params!["_local", &tool.function.name, &tool.function.description],
        )?;
    }

    Ok(conn.last_insert_rowid())
}

/// Inserts a new chat message into the database
pub fn update_tool_status(
    server_name: String,
    tool_name: String,
    status: bool,
) -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE tools
         SET
            enabled = ?3
         WHERE server = ?1 AND name = ?2",
        rusqlite::params![&server_name, &tool_name, status],
    )?;

    Ok(())
}

pub fn update_tool_status_by_server(server_name: String, status: bool) -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE tools
         SET
            enabled = ?2
         WHERE server = ?1",
        rusqlite::params![&server_name, status],
    )?;

    Ok(())
}

pub fn delete_tool_server(server_name: String) -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute(
        "DELETE FROM tools WHERE server = ?1",
        rusqlite::params![&server_name],
    )?;

    Ok(())
}

pub fn get_all_tools_by_server(server: String) -> Result<Vec<ToolData>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare("SELECT * FROM tools WHERE server = ?1")?;

    let rows = stmt.query_map([server], |row| {
        Ok(ToolData {
            server: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            enabled: row.get(3)?,
        })
    })?;

    let mut tools = Vec::new();
    for row in rows {
        tools.push(row?);
    }

    Ok(tools)
}

pub fn get_all_servers() -> Result<Vec<String>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare("SELECT DISTINCT server FROM tools")?;

    let rows = stmt.query_map([], |row| Ok(row.get(0)?))?;

    let mut servers = Vec::new();
    for row in rows {
        servers.push(row?);
    }

    Ok(servers)
}
