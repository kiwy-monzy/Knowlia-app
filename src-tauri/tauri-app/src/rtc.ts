import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface RtcSession {
  group_id: string;
  session_type: number;
  state: number;
  created_at: number;
}

export interface RtcMessage {
  group_id: string;
  content: number[];
  message_type: 'audio' | 'video' | 'chat' | 'config';
}

export interface RtcSessionConfiguration {
  audioDevice: string | null;
  videoDevice: string | null;
  screen: boolean;
  permissions: { audio: boolean; video: boolean; screen: boolean };
}

export interface RtcSessionRequest {
  group_id: string;
  session_type: number; // 1: audio, 2: video
}

export interface RtcSessionManagement {
  group_id: string;
  option: number; // 1: accept, 2: deny, 3: end
}

export class RtcService {
  private static instance: RtcService;
  private eventListeners: Map<string, UnlistenFn> = new Map();

  static getInstance(): RtcService {
    if (!RtcService.instance) {
      RtcService.instance = new RtcService();
    }
    return RtcService.instance;
  }

  // Initialize RTC module
  async init(): Promise<void> {
    await invoke('rtc_init');
  }

  // Start RTC session request
  async sessionRequest(request: RtcSessionRequest): Promise<string> {
    try {
      console.log('Starting RTC session request:', request);
      const result = await invoke<string>('rtc_session_request', { request });
      console.log('RTC session request result:', result);
      return result;
    } catch (error) {
      // Handle connection refused errors with retry
      if (error instanceof Error && error.message.includes('ERR_CONNECTION_REFUSED')) {
        console.warn('RTC connection refused, retrying in 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await invoke<string>('rtc_session_request', { request });
        console.log('RTC session request retry result:', result);
        return result;
      }
      console.error('RTC session request failed:', error);
      throw error;
    }
  }

  // Accept/deny/end RTC session
  async sessionManagement(management: RtcSessionManagement): Promise<string> {
    try {
      console.log('RTC session management:', management);
      const result = await invoke<string>('rtc_session_management', { management });
      console.log('RTC session management result:', result);
      return result;
    } catch (error) {
      console.error('RTC session management failed:', error);
      throw error;
    }
  }

  // Get list of active RTC sessions
  async sessionList(): Promise<RtcSession[]> {
    try {
      const sessions = await invoke<RtcSession[]>('rtc_session_list');
      console.log('RTC session list result:', sessions);
      return sessions;
    } catch (error) {
      console.error('RTC session list failed:', error);
      throw error;
    }
  }

  // Send RTC message (audio/video/chat)
  async sendMessage(message: RtcMessage): Promise<void> {
    await invoke('rtc_send_message', { message });
  }

  // Start a new session for a group
  async startGroupSession(groupId: string, sessionType: 'audio' | 'video' = 'audio'): Promise<string> {
    try {
      console.log(`Starting ${sessionType} session for group ${groupId}`);
      
      const request: RtcSessionRequest = {
        group_id: groupId,
        session_type: sessionType === 'audio' ? 1 : 2 // 1 for audio, 2 for video
      };
      
      const result = await this.sessionRequest(request);
      console.log(`Session started for group ${groupId}:`, result);
      return result;
    } catch (error) {
      console.error(`Failed to start session for group ${groupId}:`, error);
      throw error;
    }
  }

  // Get RTC session by ID
  async getSession(groupId: string): Promise<RtcSession | null> {
    return await invoke('rtc_get_session', { groupId });
  }

  // Remove RTC session
  async removeSession(groupId: string): Promise<void> {
    await invoke('rtc_remove_session', { groupId });
  }

  // Listen for RTC events
  async listenToRtcEvents(callback: (event: string, data: any) => void): Promise<void> {
    const events = [
      'rtc-incoming-call',
      'rtc-session-established',
      'rtc-session-ended',
      'rtc-message-received',
      'rtc-session-request-received',
      'rtc-session-configuration-received'
    ];

    for (const event of events) {
      if (!this.eventListeners.has(event)) {
        const unlisten = await listen(event, (eventData) => {
          console.log(`RTC Event received: ${event}`, eventData.payload);
          callback(event, eventData.payload);
        });
        this.eventListeners.set(event, unlisten);
      }
    }
  }

  // Handle incoming RTC session configuration
  async handleSessionConfiguration(groupId: string, config: RtcSessionConfiguration): Promise<void> {
    console.log('Received session configuration for', groupId, ':', config);
    
    // Emit event for UI to handle
    // This would typically be handled by the event listeners
    // For now, we'll just log the configuration
    if (config.permissions.audio && config.audioDevice) {
      console.log('Audio device selected:', config.audioDevice);
    }
    if (config.permissions.video && config.videoDevice) {
      console.log('Video device selected:', config.videoDevice);
    }
    if (config.permissions.screen) {
      console.log('Screen sharing enabled');
    }
  }

  // Stop listening to RTC events
  stopListening(): void {
    this.eventListeners.forEach((unlisten) => {
      unlisten();
    });
    this.eventListeners.clear();
  }

  // Helper methods for common RTC operations

  // Start a voice call
  async startVoiceCall(groupId: string): Promise<string> {
    return this.sessionRequest({
      group_id: groupId,
      session_type: 1 // Audio
    });
  }

  // Start a video call
  async startVideoCall(groupId: string): Promise<string> {
    return this.sessionRequest({
      group_id: groupId,
      session_type: 2 // Video
    });
  }

  // Send session configuration data
  async sendSessionConfiguration(groupId: string, config: RtcSessionConfiguration): Promise<void> {
    const content = Array.from(new TextEncoder().encode(JSON.stringify(config)));
    await this.sendMessage({
      group_id: groupId,
      content,
      message_type: 'config'
    });
  }

  // Start screen sharing
  async startScreenShare(groupId: string): Promise<string> {
    return this.sessionRequest({
      group_id: groupId,
      session_type: 3 // Screen share
    });
  }

  // Accept incoming call
  async acceptCall(groupId: string): Promise<string> {
    return this.sessionManagement({
      group_id: groupId,
      option: 1 // Accept
    });
  }

  // Decline incoming call
  async declineCall(groupId: string): Promise<string> {
    return this.sessionManagement({
      group_id: groupId,
      option: 2 // Deny
    });
  }

  // End call
  async endCall(groupId: string): Promise<string> {
    return this.sessionManagement({
      group_id: groupId,
      option: 3 // End
    });
  }

  // Send audio data
  async sendAudio(groupId: string, audioData: ArrayBuffer): Promise<void> {
    const content = Array.from(new Uint8Array(audioData));
    await this.sendMessage({
      group_id: groupId,
      content,
      message_type: 'audio'
    });
  }

  // Send video data
  async sendVideo(groupId: string, videoData: ArrayBuffer): Promise<void> {
    const content = Array.from(new Uint8Array(videoData));
    await this.sendMessage({
      group_id: groupId,
      content,
      message_type: 'video'
    });
  }

  // Send chat message during call
  async sendChatMessage(groupId: string, message: string): Promise<void> {
    const content = Array.from(new TextEncoder().encode(message));
    await this.sendMessage({
      group_id: groupId,
      content,
      message_type: 'chat'
    });
  }

  // Check if session exists and is established
  async isSessionActive(groupId: string): Promise<boolean> {
    const session = await this.getSession(groupId);
    return session !== null && session.state === 3; // State 3 = established
  }

  // Get all active sessions
  async getAllSessions(): Promise<RtcSession[]> {
    return this.sessionList();
  }

  // Get session by group ID (alias for getSession)
  async getSessionById(groupId: string): Promise<RtcSession | null> {
    return this.getSession(groupId);
  }

  // Remove all sessions
  async removeAllSessions(): Promise<void> {
    const sessions = await this.sessionList();
    for (const session of sessions) {
      await this.removeSession(session.group_id);
    }
  }

  // Get session count
  async getSessionCount(): Promise<number> {
    const sessions = await this.sessionList();
    return sessions.length;
  }

  // Get sessions by type
  async getSessionsByType(sessionType: number): Promise<RtcSession[]> {
    const sessions = await this.sessionList();
    return sessions.filter(session => session.session_type === sessionType);
  }

  // Get active sessions only
  async getActiveSessions(): Promise<RtcSession[]> {
    const sessions = await this.sessionList();
    return sessions.filter(session => session.state === 3); // State 3 = established
  }

  // Check if any session exists
  async hasActiveSessions(): Promise<boolean> {
    const count = await this.getSessionCount();
    return count > 0;
  }
}

export const rtcService = RtcService.getInstance();
