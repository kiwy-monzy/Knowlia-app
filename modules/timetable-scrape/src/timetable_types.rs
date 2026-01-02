use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Venue {
    pub id: i32,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct Course {
    pub id: i32,
    pub name: Option<String>,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct Programme {
    pub id: i32,
    pub name: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct Unit {
    pub id: i32,
    pub name: String,
    pub code: String,
}

// TimetableSession type matching TypeScript structure
#[derive(Debug, Deserialize, Serialize)]
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

// Schedules API types
#[derive(Debug, Deserialize, Serialize)]
pub struct SchedulesResponse {
    pub count: i32,
    pub next: Option<String>,
    pub previous: Option<String>,
    pub results: Vec<Schedule>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Schedule {
    pub id: i32,
    pub attachments: Vec<Attachment>,
    pub events_count: i32,
    pub semester: Semester,
    pub name: String,
    pub status: String,
    pub active: bool,
    pub is_exam_schedule: bool,
    pub is_special_exam_schedule: bool,
    pub date_created: String,
    pub date_modified: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Attachment {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub file: String,
    pub schedule: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Semester {
    pub id: i32,
    pub academic_year: AcademicYear,
    pub number: String,
    pub number_of_weeks: i32,
    pub study_weeks: i32,
    pub exams_start_week: i32,
    pub start_date: String,
    pub end_date: String,
    pub extra: serde_json::Value,
    pub date_created: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AcademicYear {
    pub id: i32,
    pub name: String,
    pub is_active: bool,
    pub extra: serde_json::Value,
    pub date_created: String,
}