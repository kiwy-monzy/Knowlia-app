use serde::{Deserialize, Serialize};
use anyhow::Result;
use reqwest::Client;
use futures::future::join_all;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponse {
    // Define the structure based on your API response
    pub data: Vec<serde_json::Value>,
    // Add other fields as needed
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
    let join_results = join_all(tasks).await;
    
    for join_res in join_results {
        match join_res {
            Ok(Ok(api_resp)) => results.push(api_resp),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(anyhow::anyhow!("Task join error: {}", e)),
        }
    }

    Ok(results)
}