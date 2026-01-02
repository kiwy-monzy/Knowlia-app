use anyhow::Result;
use rusqlite::{Connection, params};
use crate::timetable_types::{Venue, Course, Programme, Unit, TimetableSession};

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // Enable WAL mode and set busy timeout to handle concurrent access
        conn.execute("PRAGMA journal_mode=WAL", [])?;
        conn.execute("PRAGMA busy_timeout=5000", [])?;
        
        let db = Database { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        // Create venues table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS venues (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )",
            [],
        )?;

        // Create courses table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY,
                name TEXT,
                code TEXT NOT NULL UNIQUE
            )",
            [],
        )?;

        // Create programmes table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS programmes (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE
            )",
            [],
        )?;

        // Create units table
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS units (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE
            )",
            [],
        )?;

        // Create events table matching TimetableSession structure
        self.conn.execute(
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
        )?;

        Ok(())
    }

    pub fn insert_venue(&self, venue: &Venue) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO venues (id, name) VALUES (?, ?)",
            params![venue.id, venue.name.as_str()],
        )?;
        Ok(())
    }

    pub fn insert_course(&self, course: &Course) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO courses (id, name, code) VALUES (?, ?, ?)",
            params![course.id, course.name.as_deref().unwrap_or(""), course.code.as_str()],
        )?;
        Ok(())
    }

    pub fn insert_programme(&self, programme: &Programme) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO programmes (id, name, code) VALUES (?, ?, ?)",
            params![programme.id, programme.name.as_str(), programme.code.as_str()],
        )?;
        Ok(())
    }

    pub fn insert_unit(&self, unit: &Unit) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO units (id, name, code) VALUES (?, ?, ?)",
            params![unit.id, unit.name.as_str(), unit.code.as_str()],
        )?;
        Ok(())
    }

    pub fn insert_event(&self, event: &TimetableSession, schedule_id: i32) -> Result<()> {
        self.conn.execute(
            "INSERT INTO events (subject, location, start, end, type, short_code, schedule_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                event.subject.as_str(),
                event.location.as_str(),
                event.start.as_str(),
                event.end.as_str(),
                event.event_type.as_str(),
                event.short_code.as_deref().unwrap_or(""),
                schedule_id,
            ],
        )?;
        Ok(())
    }

    pub fn get_venue_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM venues",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_course_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM courses",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_programme_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM programmes",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_unit_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM units",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn get_event_count(&self) -> Result<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM events",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}