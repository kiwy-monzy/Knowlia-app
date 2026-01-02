// Test script to verify the get_all_neighbours_ui_command functionality
// This can be run in the browser console or Tauri dev tools

async function testAllNeighbours() {
    try {
        console.log('Testing get_all_neighbours_ui_command...');
        
        // Call the new command
        const allNeighbours = await window.__TAURI__.invoke('get_all_neighbours_ui_command');
        
        console.log('All neighbours:', allNeighbours);
        
        // Group by connection type
        const grouped = {
            internet: [],
            lan: [],
            ble: [],
            local: []
        };
        
        allNeighbours.forEach(neighbour => {
            if (grouped[neighbour.connection_type]) {
                grouped[neighbour.connection_type].push(neighbour);
            }
        });
        
        console.log('Grouped by connection type:', grouped);
        
        // Display summary
        console.log(`
=== Network Connections Summary ===
Internet: ${grouped.internet.length} connections
LAN: ${grouped.lan.length} connections  
BLE: ${grouped.ble.length} connections
Local: ${grouped.local.length} connections
Total: ${allNeighbours.length} connections
        `);
        
        return allNeighbours;
    } catch (error) {
        console.error('Error testing get_all_neighbours_ui_command:', error);
        return null;
    }
}

// Also test the original internet-only command for comparison
async function testInternetNeighbours() {
    try {
        console.log('Testing get_internet_neighbours_ui_command...');
        
        const internetNeighbours = await window.__TAURI__.invoke('get_internet_neighbours_ui_command');
        
        console.log('Internet neighbours only:', internetNeighbours);
        
        return internetNeighbours;
    } catch (error) {
        console.error('Error testing get_internet_neighbours_ui_command:', error);
        return null;
    }
}

// Run both tests
async function runTests() {
    console.log('=== Testing Neighbour Commands ===');
    
    await testInternetNeighbours();
    console.log('\n');
    await testAllNeighbours();
}

// Export for use in browser console
window.testNeighbours = {
    testAllNeighbours,
    testInternetNeighbours,
    runTests
};

console.log('Neighbour test functions loaded. Use window.testNeighbours.runTests() to test.');
