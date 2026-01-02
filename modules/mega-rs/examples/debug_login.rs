//!
//! Debug example to test login with increased timeouts and logging
//!

use std::env;
use std::time::Duration;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    // Enable detailed logging
    env::set_var("RUST_LOG", "debug");
    
    let email = "jayshevien@gmail.com";
    let password = "shevienPaty@2";
    let mfa = "";

    println!("Attempting to login to MEGA...");
    println!("Email: {}", email);
    println!("MFA: {}", !mfa.is_empty());

    // Create client with increased timeouts and retries
    let http_client = reqwest::Client::new();
    let mut mega = mega::Client::builder()
        .max_retries(5)  // Reduce retries to fail faster for testing
        .min_retry_delay(Duration::from_millis(1000))
        .max_retry_delay(Duration::from_secs(10))
        .timeout(Some(Duration::from_secs(30)))
        .build(http_client)
        .unwrap();

    println!("Client configured with custom timeout/retry settings");

    let mfa_option = if mfa.is_empty() { None } else { Some(mfa) };
    match mega.login(&email, &password, mfa_option).await {
        Ok(_) => {
            println!("Login successful!");
            
            // Try a simple operation
            match mega.fetch_own_nodes().await {
                Ok(nodes) => {
                    println!("Successfully fetched nodes");
                    println!("Cloud drive: {:?}", nodes.cloud_drive().map(|n| n.name()));
                    println!("Total nodes: {}", nodes.len());
                }
                Err(e) => {
                    println!("Failed to fetch nodes: {:?}", e);
                }
            }
            
            mega.logout().await.unwrap();
            println!("Logout successful");
        }
        Err(e) => {
            println!("Login failed: {:?}", e);
            println!("Error type: {}", std::any::type_name_of_val(&e));
        }
    }
}
