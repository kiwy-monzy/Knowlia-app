import { invoke } from "@tauri-apps/api/core";

// Define types locally since $lib/types is not available
interface Screenshot {
  id: string;
  data: string;
  timestamp: number;
  type: string;
}

interface UserIntentionHistory {
  id?: string;
  llm_user_intention: string;
  llm_user_state: string;
  llm_keywords?: string;
  created_at: number;
}

// Session types
export interface ChatSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  last_message?: string;
}

export async function takeScreenshot(
  type: "fullscreen" | "window",
): Promise<{ screenshot: Screenshot | null; error: string }> {
  try {
    const error = "";

    const screenshot = await invoke<Screenshot>("take_screenshot", {
      screenType: type,
      fromTest: true,
    });

    return { screenshot, error };
  } catch (err) {
    return {
      screenshot: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getScreenshotsContext(
  timeWindowMinutes?: number,
): Promise<string> {
  try {
    const result = await invoke<string>("screenshots_context", {
      timeWindowMinutes: timeWindowMinutes || null,
    });

    return result;
  } catch (error) {
    console.error("Failed to analyze user intention:", error);
    throw new Error(error as string);
  }
}

export async function getScreenshotOCR(): Promise<string> {
  try {
    const { lines } = await invoke<{ lines: string[] }>(
      "take_screenshot_and_process",
    );

    return lines.join("\n");
  } catch (error) {
    console.error("Failed to analyze user intention:", error);
    throw new Error(error as string);
  }
}

export async function analyzeUserIntention(
  timeWindowMinutes?: number,
): Promise<UserIntentionHistory> {
  try {
    const result = await invoke<UserIntentionHistory>(
      "analyze_user_intention_command",
      {
        timeWindowMinutes: timeWindowMinutes || 15,
        fromTest: false,
      },
    );

    return result;
  } catch (error) {
    console.error("Failed to analyze user intention:", error);
    throw new Error(error as string);
  }
}

export async function getUserIntentions(
  limit?: number,
): Promise<UserIntentionHistory[]> {
  try {
    const result = await invoke<UserIntentionHistory[]>(
      "get_user_intentions_command",
      {
        limit: limit || 10,
      },
    );

    return result;
  } catch (error) {
    console.error("Failed to get user intentions:", error);
    throw new Error(error as string);
  }
}

export async function startIntentionAnalysis(
  intervalMinutes?: number,
): Promise<string> {
  try {
    const result = await invoke<string>("start_intention_analysis_command", {
      intervalMinutes: intervalMinutes || 15,
    });

    return result;
  } catch (error) {
    console.error("Failed to start intention analysis:", error);
    throw new Error(error as string);
  }
}

// Session management functions
export async function getAllSessions(): Promise<ChatSession[]> {
  try {
    const result = await invoke<ChatSession[]>("get_all_sessions");
    return result;
  } catch (error) {
    console.error("Failed to get all sessions:", error);
    throw new Error(error as string);
  }
}

export async function createSession(title: string): Promise<ChatSession> {
  try {
    const result = await invoke<ChatSession>("create_session", { title });
    return result;
  } catch (error) {
    console.error("Failed to create session:", error);
    throw new Error(error as string);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await invoke<void>("delete_session", { sessionId });
  } catch (error) {
    console.error("Failed to delete session:", error);
    throw new Error(error as string);
  }
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<ChatSession> {
  try {
    const result = await invoke<ChatSession>("update_session_title", { sessionId, title });
    return result;
  } catch (error) {
    console.error("Failed to update session title:", error);
    throw new Error(error as string);
  }
}

export async function getSessionMessages(sessionId: string): Promise<any[]> {
  try {
    console.log('Fetching messages for session:', sessionId);
    const result = await invoke<any[]>("get_session_messages", { sessionId });
    console.log('Session messages fetched:', result.length, 'messages');
    return result;
  } catch (error) {
    console.error("Failed to get session messages:", error);
    console.error("Error details:", typeof error, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get session messages: ${errorMessage}`);
  }
}
