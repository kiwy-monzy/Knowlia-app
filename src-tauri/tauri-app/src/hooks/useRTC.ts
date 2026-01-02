import { useState, useEffect, useCallback } from 'react';
import { rtcService, RtcSession, RtcMessage } from '@/utils/rtc';

export interface UseRtcOptions {
  groupId?: string;
  autoInitialize?: boolean;
  onIncomingCall?: (groupId: string, sessionType: number) => void;
  onSessionEstablished?: (groupId: string) => void;
  onSessionEnded?: (groupId: string) => void;
  onMessageReceived?: (groupId: string, message: RtcMessage) => void;
  onSessionRequestReceived?: (groupId: string, sessionType: number) => void;
  onActiveSessionsChange?: (sessions: RtcSession[]) => void;
}

export const useRTC = (options: UseRtcOptions = {}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeSessions, setActiveSessions] = useState<RtcSession[]>([]);
  const [currentSession, setCurrentSession] = useState<RtcSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize RTC
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await rtcService.init();
      
      // Set up event listeners
      await rtcService.listenToRtcEvents((event, data) => {
        switch (event) {
          case 'rtc-incoming-call':
            options.onIncomingCall?.(data.groupId, data.sessionType);
            break;
          case 'rtc-session-established':
            options.onSessionEstablished?.(data.groupId);
            refreshSessions();
            break;
          case 'rtc-session-ended':
            options.onSessionEnded?.(data.groupId);
            refreshSessions();
            break;
          case 'rtc-message-received':
            options.onMessageReceived?.(data.groupId, data.message);
            break;
          case 'rtc-session-request-received':
            options.onSessionRequestReceived?.(data.groupId, data.sessionType);
            break;
        }
      });
      
      setIsInitialized(true);
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize RTC');
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, options]);

  // Refresh active sessions
  const refreshSessions = useCallback(async () => {
    if (!isInitialized) return;
    
    try {
      const sessions = await rtcService.sessionList();
      setActiveSessions(sessions);
      
      // Notify about sessions change
      options.onActiveSessionsChange?.(sessions);
      
      // Update current session if groupId is specified
      if (options.groupId) {
        const session = sessions.find(s => s.group_id === options.groupId);
        setCurrentSession(session || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh sessions');
    }
  }, [isInitialized, options.groupId, options.onActiveSessionsChange]);

  // Start voice call
  const startVoiceCall = useCallback(async (groupId: string) => {
    if (!isInitialized) {
      await initialize();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await rtcService.startVoiceCall(groupId);
      await refreshSessions();
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice call');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize, refreshSessions]);

  // Start video call
  const startVideoCall = useCallback(async (groupId: string) => {
    if (!isInitialized) {
      await initialize();
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await rtcService.startVideoCall(groupId);
      await refreshSessions();
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start video call');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize, refreshSessions]);

  // Accept call
  const acceptCall = useCallback(async (groupId: string) => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await rtcService.acceptCall(groupId);
      await refreshSessions();
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept call');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, refreshSessions]);

  // Decline call
  const declineCall = useCallback(async (groupId: string) => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await rtcService.declineCall(groupId);
      await refreshSessions();
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline call');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, refreshSessions]);

  // End call
  const endCall = useCallback(async (groupId: string) => {
    if (!isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sessionId = await rtcService.endCall(groupId);
      await refreshSessions();
      return sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end call');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, refreshSessions]);

  // Send audio
  const sendAudio = useCallback(async (groupId: string, audioData: ArrayBuffer) => {
    if (!isInitialized) return;
    
    try {
      await rtcService.sendAudio(groupId, audioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send audio');
      throw err;
    }
  }, [isInitialized]);

  // Send video
  const sendVideo = useCallback(async (groupId: string, videoData: ArrayBuffer) => {
    if (!isInitialized) return;
    
    try {
      await rtcService.sendVideo(groupId, videoData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send video');
      throw err;
    }
  }, [isInitialized]);

  // Send chat message
  const sendChatMessage = useCallback(async (groupId: string, message: string) => {
    if (!isInitialized) return;
    
    try {
      await rtcService.sendChatMessage(groupId, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send chat message');
      throw err;
    }
  }, [isInitialized]);

  // Check if session is active
  const isSessionActive = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isInitialized) return false;
    
    try {
      return await rtcService.isSessionActive(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check session status');
      return false;
    }
  }, [isInitialized]);

  // Auto-initialize if enabled
  useEffect(() => {
    if (options.autoInitialize) {
      initialize();
    }
    
    // Cleanup event listeners on unmount
    return () => {
      rtcService.stopListening();
    };
  }, [initialize, options.autoInitialize]);

  // Refresh sessions periodically
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(refreshSessions, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [isInitialized, refreshSessions]);

  // Update current session when groupId changes
  useEffect(() => {
    if (options.groupId && activeSessions.length > 0) {
      const session = activeSessions.find(s => s.group_id === options.groupId);
      setCurrentSession(session || null);
    }
  }, [options.groupId, activeSessions]);

  // Initialize and check for existing sessions when groupId is set
  useEffect(() => {
    if (options.groupId && !isInitialized && options.autoInitialize) {
      initialize().then(() => {
        refreshSessions();
      });
    }
  }, [options.groupId, isInitialized, options.autoInitialize, initialize, refreshSessions]);

  return {
    // State
    isInitialized,
    activeSessions,
    currentSession,
    isLoading,
    error,
    
    // Actions
    initialize,
    refreshSessions,
    startVoiceCall,
    startVideoCall,
    acceptCall,
    declineCall,
    endCall,
    sendAudio,
    sendVideo,
    sendChatMessage,
    isSessionActive,
    
    // Utilities
    clearError: () => setError(null),
  };
};
