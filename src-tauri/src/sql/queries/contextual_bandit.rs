use crate::sql::{convert_date_str_to_utc, error::DataError, get_conn, model::BanditStat};

/// Inserts a bandit stat into the database
pub fn insert_bandit_stat(bandit_stat: BanditStat) -> Result<i64, DataError> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO bandit_stats (
            user_state,
            reward,
            to_assist,
            user_action
        ) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            &bandit_stat.user_state,
            &bandit_stat.reward,
            &bandit_stat.to_assist,
            &bandit_stat.user_action,
        ],
    )?;

    let id = conn.last_insert_rowid();

    Ok(id)
}

/// Gets all bandit stats ordered by created_at descending
pub fn get_all_bandit_stats() -> Result<Vec<BanditStat>, DataError> {
    let conn = get_conn()?;

    let mut stmt = conn.prepare(
        "SELECT
            id,
            user_state,
            reward,
            to_assist,
            user_action,
            created_at
         FROM bandit_stats
         ORDER BY created_at DESC",
    )?;

    let stats_iter = stmt.query_map([], |row| {
        let created_at_str: String = row.get(5)?;
        let created_at = convert_date_str_to_utc(&created_at_str)?;
        Ok(BanditStat {
            id: Some(row.get(0)?),
            user_state: row.get(1)?,
            reward: row.get(2)?,
            to_assist: row.get(3)?,
            user_action: row.get(4)?,
            created_at,
        })
    })?;

    let mut stats = Vec::new();
    for stat in stats_iter {
        stats.push(stat?);
    }

    Ok(stats)
}

/// Deletes all bandit stats from the database
pub fn delete_all_bandit_stats() -> Result<(), DataError> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM bandit_stats", [])?;

    Ok(())
}
