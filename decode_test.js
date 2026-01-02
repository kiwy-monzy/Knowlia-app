// Test script to demonstrate message decoding
// Based on the user's sample data from get_group_list

// Example 1: The simple "hyd" message from the second group
const simpleMessage = [10, 5, 10, 3, 104, 121, 100];
const decodedSimple = new TextDecoder().decode(new Uint8Array(simpleMessage));
console.log("Simple message decoded:", decodedSimple); // Should show "hyd"

// Example 2: Complex binary data from the first group
const complexMessage = [
    26, 42, 8, 3, 18, 38, 0, 36, 8, 1, 18, 32, 143, 73, 38, 114,
    134, 21, 241, 114, 147, 36, 206, 109, 135, 228, 163, 219, 106,
    155, 134, 153, 136, 123, 156, 160, 168, 207, 164, 224, 90, 191,
    217, 220
];

try {
    const decodedComplex = new TextDecoder().decode(new Uint8Array(complexMessage));
    console.log("Complex message decoded:", decodedComplex);
} catch (error) {
    console.log("Complex message is binary data, showing as:", `<binary data: ${complexMessage.length} bytes>`);
}

// This demonstrates exactly what our Rust code does:
// - Readable UTF-8 text gets decoded properly
// - Binary data shows as "<binary data: X bytes>" fallback
