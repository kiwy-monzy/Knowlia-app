pub mod database;
pub mod timetable;
pub mod timetable_types;
pub mod scrape;

pub use database::Database;
pub use timetable_types::{Venue, Course, Programme, Unit, TimetableSession, SchedulesResponse, Schedule};
pub use timetable::{EventData, InputJson, transform_json};

// Re-export main scraper functions
use anyhow::Result;
use serde_json;
use rusqlite::params;
use timetable::{InputJson as TimetableInputJson, transform_json as timetable_transform_json};

pub async fn run_background_scraper() -> Result<()> {
    // 1. Scrape data first (before opening DB connection to keep future Send)
    let scrape_results = scrape::scrape_all().await;
    
    // 2. Open DB and store results
    let mut db = Database::new("timetable.db")?;
    
    match scrape_results {
        Ok(responses) => {
            let mut venue_count = 0;
            let mut course_count = 0;
            let mut programme_count = 0;
            let mut unit_count = 0;

            // Use a transaction for the initial bulk data
            let tx = db.conn.transaction()?;
            for resp in responses {
                for v in resp.results.venue {
                    let _ = tx.execute(
                        "INSERT OR REPLACE INTO venues (id, name) VALUES (?, ?)",
                        params![v.id, v.name.as_str()],
                    );
                    venue_count += 1;
                }
                for c in resp.results.course {
                    let _ = tx.execute(
                        "INSERT OR REPLACE INTO courses (id, name, code) VALUES (?, ?, ?)",
                        params![c.id, c.name.as_deref().unwrap_or(""), c.code.as_str()],
                    );
                    course_count += 1;
                }
                for p in resp.results.programme {
                    let _ = tx.execute(
                        "INSERT OR REPLACE INTO programmes (id, name, code) VALUES (?, ?, ?)",
                        params![p.id, p.name.as_str(), p.code.as_str()],
                    );
                    programme_count += 1;
                }
                for u in resp.results.unit {
                    let _ = tx.execute(
                        "INSERT OR REPLACE INTO units (id, name, code) VALUES (?, ?, ?)",
                        params![u.id, u.name.as_str(), u.code.as_str()],
                    );
                    unit_count += 1;
                }
            }
            tx.commit()?;

            println!(
                "Inserted: venues={}, courses={}, programmes={}, units={}",
                venue_count, course_count, programme_count, unit_count
            );
        }
        Err(e) => eprintln!("Scraping error: {}", e),
    }

    // Drop DB connection before next await to keep future Send
    drop(db);
    
    // 3. Fetch schedules
    if let Ok(schedules_response) = fetch_schedules().await {
        let active_schedules: Vec<&Schedule> = schedules_response.results.iter()
            .filter(|schedule| schedule.active)
            .collect();
        
        if let Some(first_active) = active_schedules.first() {
            let active_schedule_id = first_active.id;
            
            // Fetch before opening DB again
            if let Ok(schedule_details) = fetch_schedule_details(active_schedule_id).await {
                let mut db = Database::new("timetable.db")?;
                let _ = parse_and_store_events(&schedule_details, active_schedule_id, &mut db);
            }
        }
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

fn parse_and_store_events(schedule_details: &str, schedule_id: i32, db: &mut Database) -> Result<i32> {
    // Parse the detailed schedule response
    let input_json: TimetableInputJson = serde_json::from_str(schedule_details)?;
    let output_json = timetable_transform_json(input_json);
    
    let mut event_count = 0;
    
    // Start a transaction for inserting all events
    let tx = db.conn.transaction()?;
    
    for week in &output_json.weeks {
        for day in &week.days {
            for session in &day.sessions {
                let _ = tx.execute(
                    "INSERT INTO events (subject, location, start, end, type, short_code, schedule_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    params![
                        session.subject.as_str(),
                        session.location.as_str(),
                        session.start.as_str(),
                        session.end.as_str(),
                        session.event_type.as_str(),
                        session.short_code.as_str(),
                        schedule_id,
                    ],
                );
                event_count += 1;
            }
        }
    }
    
    tx.commit()?;
    Ok(event_count)
}
