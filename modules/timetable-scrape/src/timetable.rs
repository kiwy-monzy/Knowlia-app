use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

// Input JSON structs - more flexible to handle different API responses
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum InputJson {
    WithEvents(EventsWrapper),
    Direct(Events),
}

#[derive(Debug, Deserialize)]
pub struct EventsWrapper {
    pub events: Events,
}

#[derive(Debug, Deserialize)]
pub struct Events {
    pub results: Results,
}

#[derive(Debug, Deserialize)]
pub struct Results {
    #[serde(rename = "Monday")]
    pub monday: DayData,
    #[serde(rename = "Tuesday")]
    pub tuesday: DayData,
    #[serde(rename = "Wednesday")]
    pub wednesday: DayData,
    #[serde(rename = "Thursday")]
    pub thursday: DayData,
    #[serde(rename = "Friday")]
    pub friday: DayData,
}

#[derive(Debug, Deserialize)]
pub struct DayData {
    pub elements: Vec<Element>,
}

#[derive(Debug, Deserialize)]
pub struct Element {
    pub id: String,
    pub data: Vec<EventData>,
}

#[derive(Debug, Deserialize)]
pub struct EventData {
    pub meeting_time: MeetingTime,
    pub venue: Venue,
    pub course: Course,
    pub event_type: EventType,
    pub week: String,
}

#[derive(Debug, Deserialize)]
pub struct MeetingTime {
    pub day: String,
    pub from_time: u32,
    pub from_time_min: u32,
    pub to_time: u32,
    pub to_time_min: u32,
}

#[derive(Debug, Deserialize)]
pub struct Venue {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct Course {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct EventType {
    pub name: String,
}

// Output JSON structs
#[derive(Debug, Serialize)]
pub struct OutputJson {
    pub weeks: Vec<Week>,
}

#[derive(Debug, Serialize)]
pub struct Week {
    pub week: String,
    pub days: Vec<Day>,
}

#[derive(Debug, Serialize)]
pub struct Day {
    pub day: String,
    pub sessions: Vec<Session>,
}

#[derive(Debug, Serialize)]
pub struct Session {
    pub subject: String,
    pub location: String,
    pub start: String,
    pub end: String,
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(rename = "shortCode")]
    pub short_code: String,
}

// Format time as HH:MM
fn format_time(hour: u32, minute: u32) -> String {
    format!("{:02}:{:02}", hour, minute)
}

// Transform input JSON to output JSON
pub fn transform_json(input: InputJson) -> OutputJson {
    let mut week_map: HashMap<String, HashMap<String, Vec<Session>>> = HashMap::new();

    // Extract events based on the input format
    let events = match input {
        InputJson::WithEvents(wrapper) => wrapper.events,
        InputJson::Direct(events) => events,
    };

    // Process all days
    let days = vec![
        ("Monday", &events.results.monday),
        ("Tuesday", &events.results.tuesday),
        ("Wednesday", &events.results.wednesday),
        ("Thursday", &events.results.thursday),
        ("Friday", &events.results.friday),
    ];

    for (day_name, day_data) in days {
        for element in &day_data.elements {
            for event in &element.data {

                let session = Session {
                    subject: event.course.name.clone(),
                    location: event.venue.name.clone(),
                    start: format_time(event.meeting_time.from_time, event.meeting_time.from_time_min),
                    end: format_time(event.meeting_time.to_time, event.meeting_time.to_time_min),
                    event_type: event.event_type.name.to_lowercase(),
                    short_code: event.course.code.clone(),
                };

                week_map
                    .entry(event.week.clone())
                    .or_insert_with(HashMap::new)
                    .entry(day_name.to_string())
                    .or_insert_with(Vec::new)
                    .push(session);
            }
        }
    }

    // Convert week_map to OutputJson
    let mut weeks: Vec<Week> = week_map
        .into_iter()
        .map(|(week_num, days_map)| {
            let days: Vec<Day> = days_map
                .into_iter()
                .map(|(day_name, sessions)| Day {
                    day: day_name,
                    sessions,
                })
                .collect();
            Week {
                week: format!("Exam week {}", week_num),
                days,
            }
        })
        .collect();

    // Sort weeks by number
    weeks.sort_by(|a, b| a.week.cmp(&b.week));

    OutputJson { weeks }
}

// Fetch, transform, and save timetable JSON from the given URL
pub async fn fetch_and_transform_timetable(url: &str, output_path: &str) -> anyhow::Result<()> {
    let resp = reqwest::get(url).await?.text().await?;
    
    // First, print the raw response to understand the structure
    println!("Raw API Response:");
    println!("{}", resp);
    println!("--- End of Response ---");
    
    // Try to parse as the expected format
    match serde_json::from_str::<InputJson>(&resp) {
        Ok(input_json) => {
            let output_json = transform_json(input_json);
            let output_str = serde_json::to_string_pretty(&output_json)?;
            println!("Transformed Output:");
            println!("{}", output_str);
            fs::write(output_path, output_str)?;
        }
        Err(e) => {
            println!("Failed to parse as expected format: {}", e);
            
            // Try to parse as a generic JSON value to see the structure
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&resp) {
                println!("JSON structure:");
                println!("{}", serde_json::to_string_pretty(&value)?);
            }
            return Err(e.into());
        }
    }
    
    Ok(())
}