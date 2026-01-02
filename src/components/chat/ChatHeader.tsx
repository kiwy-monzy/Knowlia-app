import { Search, MoreVertical, Users, Hash, Info, X, Phone, Video, PhoneOff, Monitor, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChatContext } from '@/contexts/ChatContext';
import { useState } from 'react';
import { rtcService, RtcSession } from '@/utils/rtc';
import { useRTC } from '@/hooks/useRTC';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  onToggleInfo: () => void;
  onToggleMembers: () => void;
}

const ChatHeader = ({ onToggleInfo, onToggleMembers }: ChatHeaderProps) => {
  const { 
    currentChannel, 
    searchTerm, 
    setSearchTerm, 
    contacts, 
    selectedMessages, 
    clearMessageSelection, 
    isSelectionMode,
    deleteMessages 
  } = useChatContext();
  const [showSearch, setShowSearch] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const { 
    activeSessions: rtcSessions, 
    isLoading: isStartingCall, 
    startVoiceCall: rtcStartVoiceCall,
    startVideoCall: rtcStartVideoCall,
    acceptCall: rtcAcceptCall,
    declineCall: rtcDeclineCall,
    endCall: rtcEndCall,
    refreshSessions
  } = useRTC({ autoInitialize: true });

  // Handle multi-select delete
  const handleMultiDelete = async () => {
    try {
      await deleteMessages(Array.from(selectedMessages));
      setShowDeleteModal(false);
      clearMessageSelection();
    } catch (error) {
      console.error('Failed to delete messages:', error);
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    clearMessageSelection();
  };


  const startVoiceCall = async () => {
    if (currentChannel) {
      // For RTC, we need to use the actual PeerId, not group ID
      // Check if this is a direct message with a valid PeerId
      let targetPeerId: string;
      
      if (currentChannel.type === 'dm' && currentChannel.members && currentChannel.members.length > 0) {
        // For DMs, use the other member's PeerId
        targetPeerId = currentChannel.members[0].id;
      } else {
        // For groups, we can't start RTC calls without a specific target
        console.error('RTC calls are only supported for direct messages');
        return;
      }

      try {
        await rtcStartVoiceCall(targetPeerId);
        console.log('Voice call request sent to:', targetPeerId);
      } catch (error) {
        console.error('Failed to start voice call:', error);
      }
    }
  };

  const startVideoCall = async () => {
    if (currentChannel) {
      // For RTC, we need to use the actual PeerId, not group ID
      // Check if this is a direct message with a valid PeerId
      let targetPeerId: string;
      
      if (currentChannel.type === 'dm' && currentChannel.members && currentChannel.members.length > 0) {
        // For DMs, use the other member's PeerId
        targetPeerId = currentChannel.members[0].id;
      } else {
        // For groups, we can't start RTC calls without a specific target
        console.error('RTC calls are only supported for direct messages');
        return;
      }

      try {
        await rtcStartVideoCall(targetPeerId);
        console.log('Video call request sent to:', targetPeerId);
      } catch (error) {
        console.error('Failed to start video call:', error);
      }
    }
  };

  const startScreenShare = async () => {
    if (currentChannel) {
      let targetPeerId: string;
      
      if (currentChannel.type === 'dm' && currentChannel.members && currentChannel.members.length > 0) {
        targetPeerId = currentChannel.members[0].id;
      } else {
        console.error('RTC calls are only supported for direct messages');
        return;
      }

      try {
        await rtcService.sessionRequest({
          group_id: targetPeerId,
          session_type: 3, // screen share
        });
        refreshSessions();
        console.log('Screen share request sent to:', targetPeerId);
      } catch (error) {
        console.error('Failed to start screen share:', error);
      }
    }
  };

  const acceptCall = async (sessionId: string) => {
    try {
      await rtcAcceptCall(sessionId);
      console.log('Call accepted:', sessionId);
    } catch (error) {
      console.error('Failed to accept call:', error);
    }
  };

  const declineCall = async (sessionId: string) => {
    try {
      await rtcDeclineCall(sessionId);
      console.log('Call declined:', sessionId);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  };

  const endCall = async (sessionId: string) => {
    try {
      await rtcEndCall(sessionId);
      console.log('Call ended:', sessionId);
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };


  const getSessionForCurrentChannel = () => {
    return rtcSessions.find((session: RtcSession) => session.group_id === currentChannel?.id);
  };

  if (!currentChannel) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getMemberCount = () => {
    if (currentChannel.members) {
      return currentChannel.members.length;
    }
    return 0;
  };

  const getOnlineCount = () => {
    if (currentChannel.members) {
      // Use real-time contacts data to count online members
      return currentChannel.members.filter(member => {
        const contact = contacts.find(c => c.id === member.id);
        return contact?.isOnline || false;
      }).length;
    }
    return 0;
  };

  // Get real-time online status from contacts for direct messages
  const getDMOnlineStatus = () => {
    if (currentChannel.type === 'dm' && currentChannel.members && currentChannel.members.length > 0) {
      const member = currentChannel.members[0];
      const contact = contacts.find(c => c.id === member.id);
      return contact?.isOnline || false;
    }
    return false;
  };

  return (
    <div className="h-[48px] px-6 flex items-center justify-between  bg-background/95 border-b border-border backdrop-blur-sm">
      {/* Left: Channel Info */}
      <button 
        onClick={onToggleInfo}
        className="flex items-center gap-3 hover:bg-muted/50 rounded-xl p-2 -ml-2 transition-colors"
      >
        {currentChannel.type === 'dm' ? (
          <div className="relative">
            <Avatar className="h-8 w-8 ring-2 ring-primary/20">
              {currentChannel.members && currentChannel.members.length > 0 ? (
                currentChannel.members[0].profilePic ? (
                  <img 
                    src={currentChannel.members[0].profilePic} 
                    alt={currentChannel.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                    {getInitials(currentChannel.name)}
                  </AvatarFallback>
                )
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                  {getInitials(currentChannel.name)}
                </AvatarFallback>
              )}
            </Avatar>
          </div>
        ) : (
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Hash className="h-5 w-5 text-primary" />
          </div>
        )}

        <div className="text-left">
          <h2 className="font-semibold text-foreground">{currentChannel.name}</h2>
          <p className="text-xs text-muted-foreground">
            {currentChannel.type === 'dm' ? (
              <span className="flex items-center gap-1 hidden">
                {getDMOnlineStatus() ? (
                  <span className="text-chat-online font-medium">Online</span>
                ) : (
                  <span className="text-chat-offline font-medium">Offline</span>
                )}
                {currentChannel.members?.[0]?.college && (
                  <>
                    <span>·</span>
                    <span className="line-clamp-1">{currentChannel.members[0].college}</span>
                  </>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {getMemberCount()} members · {getOnlineCount()} online
              </span>
            )}
          </p>
        </div>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {isSelectionMode ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-sm font-medium text-foreground">
              {selectedMessages.size} selected
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={exitSelectionMode}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setShowDeleteModal(true)}
              disabled={selectedMessages.size === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : showSearch ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in conversation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 h-9 pl-9 rounded-lg"
                autoFocus
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => {
                setShowSearch(false);
                setSearchTerm('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
            
            {/* RTC Actions - Simple Icons */}
            <div className="flex items-center gap-1 hidden">
              {getSessionForCurrentChannel() ? (
                /* Show Ongoing Calls indicator when there's an active session */
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Ongoing Call</span>
                </div>
              ) : currentChannel.type === 'dm' ? (
                <>
                  {/* Voice Call Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={startVoiceCall}
                    disabled={isStartingCall}
                    title="Start voice call"
                  >
                    {isStartingCall ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Phone className="h-[18px] w-[18px]" />
                    )}
                  </Button>

                  {/* Video Call Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={startVideoCall}
                    disabled={isStartingCall}
                    title="Start video call"
                  >
                    {isStartingCall ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Video className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                {/* Screen Share Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={startScreenShare}
                    disabled={isStartingCall}
                    title="Start screen share"
                  >
                    {isStartingCall ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Monitor className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                </>
              ) : null}

              {/* Active Sessions Dropdown */}
              {rtcSessions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted relative"
                      title={`Active sessions: ${rtcSessions.length}`}
                    >
                      <Users className="h-[18px] w-[18px]" />
                      {rtcSessions.length > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
                          {rtcSessions.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Active Sessions</h4>
                        <span className="text-xs text-muted-foreground">{rtcSessions.length} sessions</span>
                      </div>
                      <div className="space-y-2">
                        {rtcSessions.map((session: RtcSession) => (
                          <div key={session.group_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                session.state === 3 ? 'bg-green-500' : 
                                session.state === 2 ? 'bg-yellow-500' : 
                                session.state === 1 ? 'bg-blue-500' : 'bg-gray-400'
                              }`} />
                              <div>
                                <p className="text-sm font-medium">
                                  {session.state === 1 ? 'Calling...' : 
                                   session.state === 2 ? 'Incoming Call' : 
                                   session.state === 3 ? 'Active Call' : 'Session'}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {session.group_id.substring(0, 12)}...
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                session.state === 3 ? 'bg-green-100 text-green-700' : 
                                session.state === 2 ? 'bg-yellow-100 text-yellow-700' : 
                                session.state === 1 ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {session.state === 3 ? 'Active' : 
                                 session.state === 2 ? 'Incoming' : 
                                 session.state === 1 ? 'Calling' : 'Pending'}
                              </span>
                              
                              {/* Show accept/decline buttons for incoming calls (state 2) */}
                              {session.state === 2 && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded hover:bg-green-100 text-green-500"
                                    onClick={() => acceptCall(session.group_id)}
                                    title="Accept call"
                                  >
                                    <Phone className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded hover:bg-red-100 text-red-500"
                                    onClick={() => declineCall(session.group_id)}
                                    title="Decline call"
                                  >
                                    <PhoneOff className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              
                              {/* Show end button for outgoing calls (state 1) and active calls (state 3) */}
                              {(session.state === 1 || session.state === 3) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded hover:bg-red-100 text-red-500"
                                  onClick={() => endCall(session.group_id)}
                                  title="End call"
                                >
                                  <PhoneOff className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {/* Default Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onToggleInfo} className="gap-3">
                  <Info className="h-4 w-4" />
                  View Info
                </DropdownMenuItem>
                {currentChannel.type === 'group' && (
                  <DropdownMenuItem onClick={onToggleMembers} className="gap-3">
                    <Users className="h-4 w-4" />
                    View Members
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSearch(true)} className="gap-3">
                  <Search className="h-4 w-4" />
                  Search Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Multi-Select Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Messages?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete {selectedMessages.size} message{selectedMessages.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMultiDelete}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
