import { invoke } from '@tauri-apps/api/core';

/**
 * Safely invoke Tauri commands with error handling
 * This helps prevent callback errors during development when the app is reloaded
 */
export async function safeInvoke<T>(command: string, args?: any): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Filter out callback errors that occur during development
    if (error instanceof Error && error.message.includes('Couldn\'t find callback id')) {
      console.warn(`Tauri callback error (expected during development):`, error.message);
      throw new Error('Operation cancelled due to app reload');
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Safely listen to Tauri events with error handling
 */
export async function safeListen<T>(
  event: string, 
  handler: (event: { payload: T }) => void
) {
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen<T>(event, handler);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Couldn\'t find callback id')) {
      console.warn(`Tauri callback error (expected during development):`, error.message);
      return () => {}; // Return empty cleanup function
    }
    throw error;
  }
}
