use std::fs;
use base64::{engine::general_purpose::STANDARD, Engine as _};

fn main() {
    // Read the PNG file
    let image_data = fs::read("user.png").expect("Failed to read user.png");
    
    // Convert to base64
    let base64_string = STANDARD.encode(&image_data);
    
    // Create the data URL format
    let data_url = format!("data:image/png;base64,{}", base64_string);
    
    // Print the result
    println!("Base64 length: {}", base64_string.len());
    println!("Data URL length: {}", data_url.len());
    println!("First 100 chars: {}", &data_url[..100]);
    
    // Write to a file for easier copying
    fs::write("user_base64.txt", &data_url).expect("Failed to write base64 file");
    println!("Base64 data written to user_base64.txt");
}
