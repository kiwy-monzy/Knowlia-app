use std::env;
use std::fs;
use std::path::Path;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, AUTHORIZATION, CACHE_CONTROL, CONNECTION, HOST, USER_AGENT};
use serde::{Deserialize, Serialize};
use base64::Engine;
use dotenvy;
use uuid::Uuid;
use std::f64::consts::PI;
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LatLng {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub south_west: LatLng,
    pub north_east: LatLng,
}

fn generate_viewport_with_padding(pickup: LatLng, destination: LatLng, padding_m: f64) -> Viewport {
    const EARTH_RADIUS: f64 = 6_371_000.0;

    // Calculate bounds (min/max)
    let min_lat = pickup.lat.min(destination.lat);
    let max_lat = pickup.lat.max(destination.lat);
    let min_lng = pickup.lng.min(destination.lng);
    let max_lng = pickup.lng.max(destination.lng);

    // Convert padding in meters to degrees
    // Use the midpoint latitude to get better longitude conversion accuracy
    let mid_lat = (min_lat + max_lat) / 2.0;
    let delta_lat = (padding_m / EARTH_RADIUS) * (180.0 / PI);
    let delta_lng = (padding_m / (EARTH_RADIUS * mid_lat.to_radians().cos())) * (180.0 / PI);

    // Apply padding
    Viewport {
        south_west: LatLng {
            lat: min_lat - delta_lat,
            lng: min_lng - delta_lng,
        },
        north_east: LatLng {
            lat: max_lat + delta_lat,
            lng: max_lng + delta_lng,
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxiVehicle {
    pub id: String,
    pub lat: f64,
    pub lng: f64,
    pub bearing: f64,
    pub icon_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub record_id: i32,
}

// REMOVE parsing structs for Bolt response (FullResponse, FullData, IconsSection, VehiclesSection, ApiTaxiVehicle, CategoryDetailsSection, TaxiIconInfo, TaxiCategoryInfo)

// (If you need to parse or use the Bolt mobility API response, always use the canonical structs in taxi_service/taxi_vehicles.rs)

pub fn generate_uuid() -> String {
    Uuid::new_v4().to_string().to_uppercase()
}

pub fn get_coordinates_from_env() -> (LatLng, LatLng) {
    // Use the same environment variables for both pickup and destination
    // Default to Dar es Salaam coordinates
    let lat_env = "-6.772355".to_string();
    let lng_env ="39.240061".to_string();
   
    
    let lat = lat_env.as_ref().ok().and_then(|s| s.parse::<f64>().ok()).unwrap_or(-6.772355);
    let lng = lng_env.as_ref().ok().and_then(|s| s.parse::<f64>().ok()).unwrap_or(39.240061);
    
    let pickup = LatLng { lat, lng };
    let destination = LatLng { lat, lng }; // Same coordinates for both
    
    //println!("Using coordinates - LAT: {}, LNG: {}", lat, lng);
    
    // Update .env file with defaults if they don't exist
    if lat_env.is_err() {
        //println!("LAT environment variable not found, adding default: -6.772355");
        let _ = update_env_file("LAT", "-6.772355");
    }
    if lng_env.is_err() {
        //println!("LNG environment variable not found, adding default: 39.240061");
        let _ = update_env_file("LNG", "39.240061");
    }
    
    (pickup, destination)
}

pub fn update_env_file(key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
    let env_path = Path::new(".env");
    
    // Read existing .env file content
    let env_content = if env_path.exists() {
        fs::read_to_string(env_path)?
    } else {
        String::new()
    };
    
    // Check if key already exists
    let key_line = format!("{}=", key);
    let lines: Vec<&str> = env_content.lines().collect();
    let mut updated_lines = Vec::new();
    let mut key_found = false;
    
    for line in lines {
        if line.starts_with(&key_line) {
            updated_lines.push(format!("{}={}", key, value));
            key_found = true;
        } else {
            updated_lines.push(line.to_string());
        }
    }
    
    // If key wasn't found, add it
    if !key_found {
        updated_lines.push(format!("{}={}", key, value));
    }
    
    // Write back to file
    fs::write(env_path, updated_lines.join("\n"))?;
    Ok(())
}

pub async fn fetch_taxi_vehicles() -> Result<String, Box<dyn std::error::Error>> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();
    //println!("Loading environment variables from .env file");
    
    // Use the same environment variables for both pickup and destination
    // LAT=-6.772368
    // LNG=39.240040
    let (pickup, destination) = get_coordinates_from_env();
    let destinations = vec![destination];

    let destination = LatLng {
        lat: -6.7812789999999996,
        lng: 39.215254999999999,
    };

    let viewport = generate_viewport_with_padding(pickup, destination, 100.0); // 100m padding
    
    let auth_username ="uid_247899280".to_string();
    let device_uuid = "F4669DCE-9F61-480A-9C02-345F12A78C32".to_string();


    //println!("Using auth_username: {}", auth_username);
    //println!("Using device_uuid: {}", device_uuid);
    let token = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", auth_username, device_uuid));
    let url = format!(
        "https://user.live.boltsvc.net/mobility/search/poll?version=CI.169.1&rh_session_id={}&language=en-GB&gps_lat={}&device_name=iPhone12%2C1&distinct_id=client-243864892&device_os_version=iOS18.2&gps_accuracy_m=5.0&deviceId={}&deviceType=iphone&gps_lng={}&lat={}&user_id={}&session_id={}u1735756510&gps_age=0.3730764389038086&lng={}",
        device_uuid, pickup.lat, device_uuid, pickup.lng, pickup.lat, auth_username.replace("uid_", ""), auth_username.replace("uid_", ""), pickup.lng
    );
    
    //println!("Making request to URL: {}", url);
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
    headers.insert(HOST, HeaderValue::from_static("user.live.boltsvc.net"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Bolt/161195418 CFNetwork/1568.300.101 Darwin/24.2.0"));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-GB,en;q=0.9"));
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Basic {}", token))?);
    let client = reqwest::Client::new();
    let response = client.post(&url)
        .headers(headers)
        .json(&serde_json::json!({
            "order_handle": {},
            "stage": "category_selection",
            "pickup_stop": { "lat": pickup.lat, "lng": pickup.lng },
            "viewport": {
                "south_west": { "lat": viewport.south_west.lat, "lng": viewport.south_west.lng },
                "north_east": { "lat": viewport.north_east.lat, "lng": viewport.north_east.lng }
            },
            "destination_stops": [
                {
                    "lng": 39.215254999999999,
                    "lat": -6.7812789999999996
                }
            ],
            "payment_method": {
                "type": "default",
                "id": "cash"
            }
        }))
        .send()
        .await?;
    let text = response.text().await?;
    //println!("RAW BOLT RESPONSE: {}", text);
    Ok(text)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartVerificationRequest {
    pub phone_number: String,
    pub uuid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmVerificationRequest {
    pub phone_number: String,
    pub uuid: String,
    pub code: String,
}

pub async fn start_verification(phone_number: String, uuid: String) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let device_uuid = "F4669DCE-9F61-480A-9C02-345F12A78C32".to_string();
    
    let (pickup, _destination) = get_coordinates_from_env();
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let url = format!(
        "https://user.live.boltsvc.net/profile/verification/start/v2?version=CI.169.1&language=en-GB&brand=bolt&deviceType=iphone&session_id={}u{}&deviceId={}&lng={}&device_os_version=iOS18.2&gps_lng={}&device_name=iPhone12,1&country=tz&gps_lat={}&distinct_id=$device:{}&gps_accuracy_m=5.0&lat={}&gps_age=1.798257827758789",
        device_uuid, timestamp, device_uuid, pickup.lng, pickup.lng, pickup.lat, generate_uuid(), pickup.lat
    );
    
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    headers.insert("Accept-Encoding", HeaderValue::from_static("gzip, deflate, br"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
    headers.insert(HOST, HeaderValue::from_static("user.live.boltsvc.net"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Bolt/161195418 CFNetwork/1568.300.101 Darwin/24.2.0"));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-GB,en;q=0.9"));
    
    let body = serde_json::json!({
        "type": "whatsapp",
        "timezone": "Africa/Dar_es_Salaam",
        "last_known_state": {
            "location": {
                "lng": pickup.lng,
                "lat": pickup.lat
            },
            "opened_product": {
                "product": "taxi"
            }
        },
        "password": uuid,
        "phone_number": phone_number,
        "method": "voice"
    });
    
    let client = reqwest::Client::new();
    let response = client.post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await?;
    
    let data: serde_json::Value = response.json().await?;
    Ok(data)
}

pub async fn confirm_verification(phone_number: String, uuid: String, code: String) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let device_uuid = "F4669DCE-9F61-480A-9C02-345F12A78C32".to_string();
    
    let (pickup, _destination) = get_coordinates_from_env();
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let url = format!(
        "https://user.live.boltsvc.net/profile/verification/confirm/v3?lng={}&rh_session_id={}u{}&country=tz&distinct_id=$device:{}&deviceId={}&device_os_version=iOS18.2&deviceType=iphone&brand=bolt&language=en-GB&session_id={}u{}&version=CI.169.1&gps_lat={}&device_name=iPhone12,1&gps_accuracy_m=5.0&gps_age=2.9224886894226074&lat={}&gps_lng={}",
        pickup.lng, device_uuid, timestamp, generate_uuid(), device_uuid, device_uuid, timestamp, pickup.lat, pickup.lat, pickup.lng
    );
    
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    headers.insert("Accept-Encoding", HeaderValue::from_static("gzip, deflate, br"));
    headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(HOST, HeaderValue::from_static("user.live.boltsvc.net"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Bolt/161195418 CFNetwork/1568.300.101 Darwin/24.2.0"));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-GB,en;q=0.9"));
    
    let body = serde_json::json!({
        "type": "whatsapp",
        "password": uuid,
        "timezone": "Africa/Dar_es_Salaam",
        "phone_number": phone_number,
        "code": code,
        "last_known_state": {
            "opened_product": {
                "product": "taxi"
            },
            "location": {
                "lat": pickup.lat,
                "lng": pickup.lng
            }
        }
    });
    
    let client = reqwest::Client::new();
    let response = client.post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await?;
    
    let data: serde_json::Value = response.json().await?;
    
    // Check if verification was successful and update BOLT_AUTH_USERNAME
    if let Some(code) = data.get("code") {
        if let Some(message) = data.get("message") {
            if code.as_i64() == Some(0) && message.as_str() == Some("OK") {
                if let Some(data_obj) = data.get("data") {
                    if let Some(auth) = data_obj.get("auth") {
                        if let Some(auth_username) = auth.get("auth_username") {
                            if let Some(username) = auth_username.as_str() {
                                update_env_file("BOLT_AUTH_USERNAME", username)?;
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(data)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationSuggestion {
    pub id: Option<String>,
    pub name: Option<String>,
    pub address: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub place_id: Option<String>,
    pub formatted_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationSuggestionsResponse {
    pub suggestions: Option<Vec<LocationSuggestion>>,
    pub code: Option<i32>,
    pub message: Option<String>,
}

pub async fn get_location_suggestions(search_string: String) -> Result<String, Box<dyn std::error::Error>> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();
    //println!("Loading environment variables from .env file");
    
    // Use the same environment variables for both pickup and destination
    // LAT=-6.772368
    // LNG=39.240040
    let (pickup, _destination) = get_coordinates_from_env();
    
    let auth_username ="uid_247899280".to_string();
    let device_uuid = "F4669DCE-9F61-480A-9C02-345F12A78C32".to_string();
    
    //println!("Using auth_username: {}", auth_username);
    //println!("Using device_uuid: {}", device_uuid);
    let token = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", auth_username, device_uuid));
    let timestamp = chrono::Utc::now().timestamp_millis();
    
    let url = format!(
        "https://user.live.boltsvc.net/rides/search/getDropoffSuggestions?device_os_version=iOS18.2&brand=bolt&search_string={}&gps_lng={}&user_id={}&deviceType=iphone&gps_lat={}&version=CI.169.1&lng={}&language=en-GB&external_search=false&country=tz&gps_age=3.798927068710327&distinct_id=client-{}&rh_session_id={}u{}&device_name=iPhone12,1&lat={}&session_id={}u{}&deviceId={}&gps_accuracy_m=5.0",
        urlencoding::encode(&search_string),
        pickup.lng,
        auth_username.replace("uid_", ""),
        pickup.lat,
        pickup.lng,
        auth_username.replace("uid_", ""),
        device_uuid,
        timestamp,
        pickup.lat,
        device_uuid,
        timestamp,
        device_uuid
    );
    
    //println!("Making request to URL: {}", url);
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    headers.insert("Accept-Encoding", HeaderValue::from_static("identity"));
    headers.insert(CONNECTION, HeaderValue::from_static("keep-alive"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    headers.insert(HOST, HeaderValue::from_static("user.live.boltsvc.net"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Bolt/161195418 CFNetwork/1568.300.101 Darwin/24.2.0"));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("en-GB,en;q=0.9"));
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Basic {}", token))?);
    
    let client = reqwest::Client::new();
    
    let response = client.get(&url)
        .headers(headers)
        .send()
        .await?;
    
    let text = response.text().await?;
    //println!("RAW BOLT LOCATION SUGGESTIONS RESPONSE: {}", text);
    Ok(text)
}