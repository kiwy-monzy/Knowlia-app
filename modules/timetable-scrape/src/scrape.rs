use serde::Deserialize;
use reqwest::Client;
use crate::timetable_types::{Venue, Course, Programme, Unit};
use anyhow::Result;

#[derive(Debug, Deserialize)]
pub struct Results {
    pub venue: Vec<Venue>,
    pub course: Vec<Course>,
    pub programme: Vec<Programme>,
    pub unit: Vec<Unit>,
}

#[derive(Debug, Deserialize)]
pub struct ApiResponse {
    pub results: Results,
}

pub async fn scrape_all() -> Result<Vec<ApiResponse>> {
    let client = Client::new();
    let mut tasks = Vec::new();

    for c in 'a'..='z' {
        let client = client.clone();
        let url = format!("https://udsm.iratiba.atomatiki.tech/api/v1/data/search/?q={}", c);
        tasks.push(tokio::spawn(async move {
            let resp = client.get(&url).send().await?;
            let json = resp.json::<ApiResponse>().await?;
            Ok::<ApiResponse, anyhow::Error>(json)
        }));
    }

    let mut results = Vec::new();
    let join_results = futures::future::join_all(tasks).await;
    
    for join_res in join_results {
        match join_res {
            Ok(Ok(api_resp)) => results.push(api_resp),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(anyhow::anyhow!("Task join error: {}", e)),
        }
    }

    Ok(results)
}