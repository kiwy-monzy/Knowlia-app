pub mod scrape;
pub mod database;
pub mod timetable;
pub mod timetable_types;

use anyhow::Result;
use database::Database;
use serde_json;
use std::fs;
use timetable_types::{SchedulesResponse, Schedule, TimetableSession};
use timetable::{InputJson, transform_json};

pub async fn run_scraper() -> Result<()> {
    // Initialize database
    let db = Database::new("timetable.db")?;

    match scrape::scrape_all().await {
        Ok(responses) => {
            let mut venue_count = 0;
            let mut course_count = 0;
            let mut programme_count = 0;
            let mut unit_count = 0;
            for resp in responses {
                for v in resp.results.venue {
                    if db.insert_venue(&v).is_ok() {
                        venue_count += 1;
                    }
                }
                for c in resp.results.course {
                    if db.insert_course(&c).is_ok() {
                        course_count += 1;
                    }
                }
                for p in resp.results.programme {
                    if db.insert_programme(&p).is_ok() {
                        programme_count += 1;
                    }
                }
                for u in resp.results.unit {
                    if db.insert_unit(&u).is_ok() {
                        unit_count += 1;
                    }
                }
            }
            println!(
                "Inserted: venues={}, courses={}, programmes={}, units={}",
                venue_count, course_count, programme_count, unit_count
            );
        }
        Err(e) => eprintln!("Scraping error: {}", e),
    }
    Ok(())
}

async fn fetch_schedules() -> Result<SchedulesResponse> {
    let url = "https://udsm.iratiba.atomatiki.tech/api/v1/data/schedules/";
    let response = reqwest::get(url).await?.text().await?;
    let schedules: SchedulesResponse = serde_json::from_str(&response)?;
    Ok(schedules)
}

async fn fetch_schedule_details(schedule_id: i32) -> Result<String> {
    let url = format!("https://udsm.iratiba.atomatiki.tech/api/v1/data/schedules/{}/?events=1", schedule_id);
    let response = reqwest::get(url).await?.text().await?;
    Ok(response)
}

fn parse_and_store_events(schedule_details: &str, schedule_id: i32, db: &Database) -> Result<i32> {
    // Parse the detailed schedule response
    let input_json: InputJson = serde_json::from_str(schedule_details)?;
    let output_json = transform_json(input_json);
    
    let mut event_count = 0;
    
    // Iterate through weeks and days to extract sessions
    for week in &output_json.weeks {
        for day in &week.days {
            for session in &day.sessions {
                let timetable_session = TimetableSession {
                    subject: session.subject.clone(),
                    location: session.location.clone(),
                    start: session.start.clone(),
                    end: session.end.clone(),
                    event_type: session.event_type.clone(),
                    short_code: session.short_code.clone(),
                };
                
                if db.insert_event(&timetable_session, schedule_id).is_ok() {
                    event_count += 1;
                }
            }
        }
    }
    
    Ok(event_count)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    run_scraper().await?;
    
    // Initialize database for events storage
    let db = Database::new("timetable.db")?;
    
    // Step 1: Fetch all schedules
    println!("Fetching schedules from API...");
    let schedules_response = fetch_schedules().await?;
    
    // Step 2: Store all schedules
    let schedules_json = serde_json::to_string_pretty(&schedules_response)?;
    fs::write("all_schedules.json", schedules_json)?;
    println!("Stored all schedules to all_schedules.json");
    
    // Step 3: Log active schedules
    let active_schedules: Vec<&Schedule> = schedules_response.results.iter()
        .filter(|schedule| schedule.active)
        .collect();
    
    println!("Active schedules found: {}", active_schedules.len());
    for schedule in &active_schedules {
        println!("  - ID: {}, Name: {}, Events: {}", 
                 schedule.id, schedule.name, schedule.events_count);
    }
    
    // Step 4: Get first active schedule
    if let Some(first_active) = active_schedules.first() {
        let active_schedule_id = first_active.id;
        println!("Using first active schedule ID: {}", active_schedule_id);
        
        // Step 5: Fetch detailed events for active schedule
        println!("Fetching detailed events for schedule {}...", active_schedule_id);
        let schedule_details = fetch_schedule_details(active_schedule_id).await?;
        
        // Step 6: Store the detailed schedule data
        fs::write("active_schedule_details.json", &schedule_details)?;
        println!("Stored detailed schedule data to active_schedule_details.json");
        
        // Step 7: Parse and store events in database
        println!("Parsing and storing events in database...");
        let event_count = parse_and_store_events(&schedule_details, active_schedule_id, &db)?;
        println!("Stored {} events in database", event_count);
        
        // Also transform and save in the original format
        let url = format!("https://udsm.iratiba.atomatiki.tech/api/v1/data/schedules/{}/?events=1&programme=73&yos=1", active_schedule_id);
        timetable::fetch_and_transform_timetable(&url, "transformed_timetable.json").await?;
        println!("Transformed timetable saved to transformed_timetable.json");
        
        // Print database statistics
        println!("\nDatabase Statistics:");
        println!("  Venues: {}", db.get_venue_count()?);
        println!("  Courses: {}", db.get_course_count()?);
        println!("  Programmes: {}", db.get_programme_count()?);
        println!("  Units: {}", db.get_unit_count()?);
        println!("  Events: {}", db.get_event_count()?);
        
    } else {
        println!("No active schedules found!");
    }
    
    Ok(())
}
