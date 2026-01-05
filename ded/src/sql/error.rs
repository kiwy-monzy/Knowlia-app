use thiserror::Error;

#[derive(Debug, Error)]
pub enum DataError {
    #[error("A database error occurred: {0}")]
    DatabaseConnection(#[from] rusqlite::Error),
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("The requested item was not found in the database.")]
    NotFound,
    #[error("Invalid key: '{0}'")]
    InvalidKey(String),
    #[error("Invalid PID: {0}")]
    InvalidPid(i32),
}

impl From<std::sync::Mutex<rusqlite::Connection>> for DataError {
    fn from(_: std::sync::Mutex<rusqlite::Connection>) -> Self {
        DataError::DatabaseConnection(rusqlite::Error::InvalidQuery)
    }
}

impl From<DataError> for String {
    fn from(error: DataError) -> Self {
        error.to_string()
    }
}
