import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Users, Menu, Phone } from 'lucide-react';
import { sessionList } from './rtc';
import { RtcService } from './rtc';

const App: React.FC = () => {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [iceStatus, setIceStatus] = useState('disconnected');
  const [micEnabled, setMicEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [groups, setGroups] = useState<Array<{
    group_id: string[];
    group_name: string;
    created_at: number;
    status: number;
    revision: number;
  }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize connection
  const handleConnect = async () => {
    if (!username.trim()) {
      alert('Please enter your name');
      return;
    }
    
    try {
      setLoading(true);
      // TODO: Initialize RTC connection with str0m
      setIsConnected(true);
      setIceStatus('connected');
      // Set the first group as selected by default if available
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0].group_name);
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle microphone
  const toggleMic = async () => {
    try {
      if (micEnabled) {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => track.stop());
          stream.getAudioTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        } else {
          localStreamRef.current = stream;
        }
      }
      setMicEnabled(!micEnabled);
    } catch (error) {
      console.error('Microphone error:', error);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    try {
      if (videoEnabled) {
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = false;
            track.stop();
          });
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 } 
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => track.stop());
          stream.getVideoTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        } else {
          localStreamRef.current = stream;
        }
      }
      setVideoEnabled(!videoEnabled);
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  // Update active sessions
  const updateActiveSessions = useCallback(async () => {
    const rtcService = RtcService.getInstance();
    try {
      const sessions = await rtcService.sessionList();
      const sessionGroupIds = new Set(sessions.map(session => session.group_id));
      setActiveSessions(sessionGroupIds);
    } catch (error) {
      console.error('Error updating active sessions:', error);
    }
  }, []);

  // Handle starting a new session
  const handleStartSession = useCallback(async (groupId: string, groupName: string) => {
    try {
      setSelectedGroup(groupName);
      const rtcService = RtcService.getInstance();
      await rtcService.startGroupSession(groupId);
      // Update active sessions after starting a new one
      await updateActiveSessions();
    } catch (error) {
      console.error('Failed to start session:', error);
      // You might want to show an error toast/notification here
    }
  }, [updateActiveSessions]);

  // Clean up on unmount and setup RTC
  useEffect(() => {
    const rtcService = RtcService.getInstance();

    const getGroupList = async () => {
      try {
        const groupList = await invoke<Array<{
          group_id: string[];
          group_name: string;
          created_at: number;
          status: number;
          revision: number;
        }>>('get_group_list');
        console.log('Group List:', groupList);
        setGroups(groupList);
        if (groupList.length > 0 && !selectedGroup) {
          setSelectedGroup(groupList[0].group_name);
        }
      } catch (error) {
        console.error('Error fetching group list:', error);
      }
    };

    const setupRtc = async () => {
      rtcService.listenToRtcEvents((event: string, data: any) => {
        console.log(`RTC Event received: ${event}`, data);
        // Update active sessions when session state changes
        if (event === 'session_created' || event === 'session_ended') {
          updateActiveSessions();
        }
      });
      
      try {
        const sessions = await rtcService.sessionList();
        console.log('Active sessions:', sessions);
        const sessionGroupIds = new Set(sessions.map(session => session.group_id));
        setActiveSessions(sessionGroupIds);
      } catch (error) {
        console.error('Error setting up RTC:', error);
      }
    };

    // Initialize
    getGroupList();
    setupRtc();

    // Cleanup
    return () => {
      // Clean up media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Add any necessary cleanup for rtcService here
    };
  }, [updateActiveSessions]);

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 rounded-md hover:bg-gray-700"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu size={20} />
          </button>
          <h1 className="text-2xl font-bold">RTC Application</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Status: {iceStatus} | {isConnected ? 'Connected' : 'Disconnected'}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div 
          className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 overflow-hidden`}
        >
          {isSidebarOpen && (
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300 flex items-center">
                <Users className="mr-2" size={18} />
                Groups
              </h2>
              <div className="space-y-1">
                {groups.map((group) => (
                  <div 
                    key={group.group_name}
                    className={`group flex items-center justify-between p-2 rounded-md ${
                      selectedGroup === group.group_name
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedGroup(group.group_name)}
                      className="flex-1 text-left flex items-center text-gray-300 hover:text-white"
                    >
                      <MessageSquare size={16} className="mr-2 flex-shrink-0" />
                      <span className="truncate">{group.group_name}</span>
                    </button>
                    {activeSessions.has(group.group_id.toString()) ? (
                      <span className="ml-2 h-2 w-2 rounded-full bg-green-500" title="Active session"></span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartSession(group.group_id.toString(), group.group_name);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-blue-400"
                        title="Start session"
                      >
                        <Phone size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          {!isConnected ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-gray-800 p-8 rounded-lg w-96">
                <h2 className="text-xl font-bold mb-4">Connect to RTC</h2>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full p-2 mb-4 bg-gray-700 rounded text-white"
                />
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Video area */}
              <div className="flex-1 bg-gray-900 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Local video */}
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full max-h-[60vh] object-cover"
                  />
                  <div className="bg-black bg-opacity-50 p-2 text-center">
                    <p className="text-sm font-medium">You ({username})</p>
                  </div>
                </div>

                {/* Remote video */}
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full max-h-[60vh] object-cover"
                  />
                  <div className="bg-black bg-opacity-50 p-2 text-center">
                    <p className="text-sm font-medium">Remote User</p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-gray-800 p-4 flex justify-center space-x-4">
                <button
                  className={`p-3 rounded-full ${
                    micEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={toggleMic}
                  title={micEnabled ? 'Mute' : 'Unmute'}
                >
                  {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  className={`p-3 rounded-full ${
                    videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={toggleVideo}
                  title={videoEnabled ? 'Stop Video' : 'Start Video'}
                >
                  {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <button
                  className="p-3 bg-red-600 hover:bg-red-700 rounded-full"
                  onClick={() => {
                    setIsConnected(false);
                    setIceStatus('disconnected');
                    if (localStreamRef.current) {
                      localStreamRef.current.getTracks().forEach(track => track.stop());
                    }
                  }}
                  title="Disconnect"
                >
                  <PhoneOff size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;