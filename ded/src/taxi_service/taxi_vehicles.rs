use crate::taxi_service::bolt::fetch_taxi_vehicles as bolt_fetch_taxi_vehicles;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxiVehicle {
    pub id: String,
    pub driver_name: String,
    pub vehicle_number: String,
    pub coordinates: [f64; 2],
    pub status: String,
    pub rating: f64,
    pub phone: String,
    pub vehicle_type: String, // This holds the type (category name)
    pub company: Option<String>,
    pub bearing: Option<f64>,
    pub icon_url: Option<String>,
    pub icon_id: Option<String>,    // add icon_id field
    pub icon_type: Option<String>,  // category name from type_map
    pub icon_group: Option<String>, // category group from type_map
}

#[derive(Deserialize)]
struct FullResponse {
    code: Option<i32>,
    message: Option<String>,
    data: Option<FullData>,
}
#[derive(Deserialize, Debug)]
struct FullData {
    vehicles: Option<VehiclesSection>,
    #[serde(default)]
    icons: IconsSection,
    #[serde(default)]
    category_details: CategoryDetailsSection,
}
#[derive(Deserialize, Debug)]
struct VehiclesSection {
    taxi: Option<std::collections::HashMap<String, Vec<ApiTaxiVehicle>>>,
}
#[derive(Deserialize, Default, Debug)]
struct IconsSection {
    #[serde(default)]
    taxi: std::collections::HashMap<String, TaxiIconInfo>,
    #[serde(default)]
    rent: std::collections::HashMap<String, TaxiIconInfo>,
    #[serde(default)]
    carsharing: std::collections::HashMap<String, TaxiIconInfo>,
}
#[derive(Deserialize, Debug, Clone)]
struct TaxiIconInfo {
    icon_url: Option<String>, // allow None for missing icons
}
#[derive(Deserialize, Default, Debug)]
struct CategoryDetailsSection {
    #[serde(default)]
    taxi: std::collections::HashMap<String, TaxiCategoryInfo>,
    #[serde(default)]
    rent: std::collections::HashMap<String, TaxiCategoryInfo>,
    #[serde(default)]
    carsharing: std::collections::HashMap<String, TaxiCategoryInfo>,
}
#[derive(Deserialize, Debug)]
struct TaxiCategoryInfo {
    name: String,
    group: Option<String>,
}
#[derive(Deserialize, Debug)]
struct ApiTaxiVehicle {
    pub id: String,
    pub lat: f64,
    pub lng: f64,
    pub bearing: f64,
    pub icon_id: String,
}

// Hardcoded icon URLs and vehicle type information
fn get_hardcoded_icon_url(icon_id: &str) -> String {
    match icon_id {
        "178" => "/bajaji.png".to_string(),
        "201" => "/xl.png".to_string(),
        "231" => "/basic.png".to_string(),
        "278" => "/boda.png".to_string(),
        "8749" => "/bolt.png".to_string(),
        "9172" => "/electric.png".to_string(),
        "9195" => "/bolt_airport.png".to_string(),
        _ => "https://via.placeholder.com/32x32?text=?".to_string(),
    }
}

fn get_hardcoded_vehicle_info(icon_id: &str) -> (String, String) {
    match icon_id {
        "178" => ("Bajaji".to_string(), "autorickshaw".to_string()),
        "201" => ("XL".to_string(), "xl".to_string()),
        "231" => ("Basic".to_string(), "economy".to_string()),
        "278" => ("Boda".to_string(), "motorbike".to_string()),
        "8749" => (
            "Send Motorbike".to_string(),
            "delivery_motorbike".to_string(),
        ),
        "9172" => ("Electric".to_string(), "electric".to_string()),
        "9195" => ("Bolt Airport".to_string(), "custom".to_string()),
        _ => (icon_id.to_string(), "unknown".to_string()),
    }
}

// Renamed below to prevent symbol collision
/// Fetches from Bolt microservice and processes result into domain TaxiVehicles
pub async fn fetch_and_build_taxi_vehicles() -> anyhow::Result<Vec<TaxiVehicle>> {
    // Get the raw JSON string from the Bolt API proxy
    let raw = bolt_fetch_taxi_vehicles()
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let parsed: Result<FullResponse, serde_json::Error> = serde_json::from_str(&raw);
    match parsed {
        Ok(full) => {
            let mut taxis_out = vec![];
            if let Some(d) = full.data {
                if let Some(vehicles) = d.vehicles.and_then(|x| x.taxi) {
                    for (_category_id, api_taxis) in vehicles {
                        for api in api_taxis {
                            let icon_url = get_hardcoded_icon_url(&api.icon_id);
                            let (vehicle_name, vehicle_group) =
                                get_hardcoded_vehicle_info(&api.icon_id);

                            taxis_out.push(TaxiVehicle {
                                id: api.id.clone(),
                                driver_name: format!("Driver {}", &api.id[..8.min(api.id.len())]),
                                vehicle_number: api.id.clone(),
                                coordinates: [api.lat, api.lng],
                                status: "available".to_string(),
                                rating: 4.5,
                                phone: "".to_string(),
                                vehicle_type: vehicle_name.clone(),
                                company: Some("bolt".to_string()),
                                bearing: Some(api.bearing),
                                icon_url: Some(icon_url),
                                icon_id: Some(api.icon_id.clone()),
                                icon_type: Some(vehicle_name),
                                icon_group: Some(vehicle_group),
                            });
                        }
                    }
                }
            }
            Ok(taxis_out)
        }
        Err(e) => {
            eprintln!("Failed to parse Bolt response: {e}");
            Ok(vec![])
        }
    }
}
