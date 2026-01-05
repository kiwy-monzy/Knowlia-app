use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flight {
    pub id: String,
    pub flight_number: String,
    pub airline: String,
    pub aircraft_type: String,
    pub origin: FlightAirport,
    pub destination: FlightAirport,
    pub current_position: Vec<f64>,
    pub altitude: f64,
    pub speed: f64,
    pub bearing: Option<f64>,
    pub status: String,
    pub departure_time: String,
    pub arrival_time: String,
    pub estimated_arrival: String,
    pub path: Option<Vec<Vec<f64>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlightAirport {
    pub airport_code: String,
    pub airport_name: String,
    pub city: String,
    pub coordinates: Vec<f64>,
}

#[tauri::command]
pub async fn get_flights() -> Result<Vec<Flight>, String> {
    // Mock flight data for Tanzania
    let mut flights = Vec::new();
    
    // Dar es Salaam to Kilimanjaro flight
    flights.push(Flight {
        id: "FL001".to_string(),
        flight_number: "TC100".to_string(),
        airline: "Air Tanzania".to_string(),
        aircraft_type: "Boeing 737".to_string(),
        origin: FlightAirport {
            airport_code: "DAR".to_string(),
            airport_name: "Julius Nyerere International Airport".to_string(),
            city: "Dar es Salaam".to_string(),
            coordinates: vec![-6.771, 39.240],
        },
        destination: FlightAirport {
            airport_code: "JRO".to_string(),
            airport_name: "Kilimanjaro International Airport".to_string(),
            city: "Kilimanjaro".to_string(),
            coordinates: vec![-3.429, 37.074],
        },
        current_position: vec![-6.5, 38.5],
        altitude: 35000.0,
        speed: 450.0,
        bearing: Some(45.0),
        status: "enroute".to_string(),
        departure_time: "08:30".to_string(),
        arrival_time: "09:45".to_string(),
        estimated_arrival: "09:40".to_string(),
        path: Some(vec![
            vec![-6.771, 39.240], // Dar es Salaam
            vec![-6.5, 38.5],    // Current position
            vec![-6.3, 38.0],     // Mid point
            vec![-3.429, 37.074], // Kilimanjaro
        ]),
    });
    
    // Zanzibar to Arusha flight
    flights.push(Flight {
        id: "FL002".to_string(),
        flight_number: "TC200".to_string(),
        airline: "Precision Air".to_string(),
        aircraft_type: "Dash 8".to_string(),
        origin: FlightAirport {
            airport_code: "ZNZ".to_string(),
            airport_name: "Abeid Amani Karume International Airport".to_string(),
            city: "Zanzibar".to_string(),
            coordinates: vec![-6.165, 39.725],
        },
        destination: FlightAirport {
            airport_code: "ARK".to_string(),
            airport_name: "Arusha Airport".to_string(),
            city: "Arusha".to_string(),
            coordinates: vec![-3.366, 36.844],
        },
        current_position: vec![-5.5, 38.2],
        altitude: 28000.0,
        speed: 380.0,
        bearing: Some(315.0),
        status: "enroute".to_string(),
        departure_time: "10:15".to_string(),
        arrival_time: "11:00".to_string(),
        estimated_arrival: "10:55".to_string(),
        path: Some(vec![
            vec![-6.165, 39.725], // Zanzibar
            vec![-5.5, 38.2],     // Current position
            vec![-4.8, 37.8],     // Mid point
            vec![-3.366, 36.844], // Arusha
        ]),
    });
    
    // Mwanza to Mbeya flight
    flights.push(Flight {
        id: "FL003".to_string(),
        flight_number: "TC300".to_string(),
        airline: "Auric Air".to_string(),
        aircraft_type: "ATR 72".to_string(),
        origin: FlightAirport {
            airport_code: "MWZ".to_string(),
            airport_name: "Mwanza Airport".to_string(),
            city: "Mwanza".to_string(),
            coordinates: vec![-2.516, 32.925],
        },
        destination: FlightAirport {
            airport_code: "MBI".to_string(),
            airport_name: "Mbeya Airport".to_string(),
            city: "Mbeya".to_string(),
            coordinates: vec![-8.845, 32.694],
        },
        current_position: vec![-4.5, 32.0],
        altitude: 22000.0,
        speed: 320.0,
        bearing: Some(225.0),
        status: "approaching".to_string(),
        departure_time: "14:20".to_string(),
        arrival_time: "15:10".to_string(),
        estimated_arrival: "15:05".to_string(),
        path: Some(vec![
            vec![-2.516, 32.925], // Mwanza
            vec![-4.5, 32.0],     // Current position
            vec![-3.5, 31.8],     // Mid point
            vec![-8.845, 32.694], // Mbeya
        ]),
    });
    
    // Dodoma to Songea flight (landed)
    flights.push(Flight {
        id: "FL004".to_string(),
        flight_number: "TC400".to_string(),
        airline: "Air Tanzania".to_string(),
        aircraft_type: "Airbus A320".to_string(),
        origin: FlightAirport {
            airport_code: "DOD".to_string(),
            airport_name: "Dodoma Airport".to_string(),
            city: "Dodoma".to_string(),
            coordinates: vec![-6.175, 35.741],
        },
        destination: FlightAirport {
            airport_code: "SGA".to_string(),
            airport_name: "Songea Airport".to_string(),
            city: "Songea".to_string(),
            coordinates: vec![-10.326, 36.682],
        },
        current_position: vec![-9.0, 36.0],
        altitude: 0.0,
        speed: 0.0,
        bearing: Some(180.0),
        status: "landed".to_string(),
        departure_time: "16:45".to_string(),
        arrival_time: "17:30".to_string(),
        estimated_arrival: "17:25".to_string(),
        path: Some(vec![
            vec![-6.175, 35.741], // Dodoma
            vec![-8.0, 36.0],     // Songea (landed)
        ]),
    });
    
    Ok(flights)
}
