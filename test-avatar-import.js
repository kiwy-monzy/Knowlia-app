// Simple test to check if Avatar component can be imported
try {
  const Avatar = require('./src/pages/Avatar.tsx');
  console.log('Avatar component imported successfully');
  console.log('Avatar type:', typeof Avatar);
  console.log('Avatar default export:', Avatar.default ? 'exists' : 'missing');
} catch (error) {
  console.error('Failed to import Avatar component:', error.message);
}
