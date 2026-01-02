import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Simple base58 encoding function (for PeerId conversion)
const base58Encode = (bytes: number[]): string => {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  
  // Convert bytes to big number
  for (const byte of bytes) {
    num = (num << 8n) + BigInt(byte);
  }
  
  // Convert to base58
  let result = '';
  while (num > 0n) {
    result = alphabet[Number(num % 58n)] + result;
    num = num / 58n;
  }
  
  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result = alphabet[0] + result;
    } else {
      break;
    }
  }
  
  return result || '1'; // Return '1' for empty result (all zeros)
};

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderCollege?: string;
  senderAvatar?: string;
  timestamp: Date;
  isOwn: boolean;
  message_type: string;
  reactions?: { emoji: string; count: number; users: string[] }[];
  replyTo?: { id: string; author: string; content: string };
  status?: 'sending' | 'sent' | 'confirmed' | 'confirmed_by_all' | 'receiving' | 'received';
  fileInfo?: {
    fileName: string;
    filePath: string;
    fileSize: number;
    fileExtension: string;
    fileId: number[] | string;
    fileDescription?: string;
  };
}

export interface Channel {
  id: string;
  name: string;
  type: 'group' | 'dm';
  createdAt: number;
  status: number;
  revision: number;
  isDirectChat: boolean;
  members: { id: string; name: string; avatar?: string; isOnline?: boolean; role: number; joinedAt: number; state: number; lastMessageIndex: number; regNo: string; college?: string; profilePic: string; about: string }[];
  unreadMessages: number;
  lastMessageAt: number;
  lastMessage: string;
  lastMessageSenderId: string;
  lastMessageStatus?: 'sending' | 'sent' | 'delivered' | 'read';
  hasActiveCall?: boolean;
  activeCallType?: 'voice' | 'video';
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  profile_pic?: string;
  profile?: string;
  isOnline?: boolean;
  lastActive?: number;
  last_seen?: number | null;
  about?: string;
  status?: string;
  blocked?: boolean;
  college?: string;
  key_base58?: string;
  q8id?: string;
  verified?: boolean;
  connections?: Array<{
    hop_count: number;
    module: number;
    rtt: number;
    via: string;
  }>;
}

export interface GroupInvitation {
  sender_id: number[];
  received_at: number;
  group: {
    group_id: number[];
    group_name: string;
    created_at: number;
    status: number;
    revision: number;
    is_direct_chat: boolean;
    members: any[];
    unread_messages: number;
    last_message_at: number;
    last_message: string;
    last_message_sender_id: number[];
  };
}

type ViewType = 'chat' | 'inbox' | 'replies' | 'posts' | 'contacts' | 'drafts' | 'requests';

interface ChatContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
  channels: Channel[];
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  contacts: UserProfile[];
  allUsers: UserProfile[];
  invitations: GroupInvitation[];
  sendMessage: (content: string) => Promise<void>;
  sendFile: (file: File, description?: string) => Promise<void>;
  getMessages: (groupId: string) => Promise<any>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  refreshChannels: () => Promise<void>;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  createGroup: (name: string) => Promise<void>;
  createDirectChat: (userId: string) => Promise<void>;
  inviteToGroup: (groupId: string, userId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  refreshContacts: () => Promise<void>;
  getPendingInvitations: () => Promise<void>;
  replyToInvitation: (groupId: string, accept: boolean) => Promise<void>;
  deleteMessages: (messageIds: string[]) => Promise<void>;
  deleteAllGroupMessages: (groupId: string) => Promise<void>;
  loading: boolean;
  contactsLoading: boolean;
  invitationsLoading: boolean;
  deleteLoading: boolean;
  // Real-time statistics for Dashboard
  totalGroups: number;
  directChats: number;
  totalUnreadMessages: number;
  refreshStats: () => void;
  // Message selection for multi-select delete
  selectedMessages: Set<string>;
  toggleMessageSelection: (messageId: string) => void;
  clearMessageSelection: () => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (enabled: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Helper function to convert GroupInfo to Channel
const convertGroupInfoToChannel = (groupInfo: any): Channel => ({
  id: Array.isArray(groupInfo.group_id) 
    ? groupInfo.group_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : groupInfo.group_id,
  name: groupInfo.group_name,
  type: groupInfo.is_direct_chat ? 'dm' : 'group',
  createdAt: groupInfo.created_at,
  status: groupInfo.status,
  revision: groupInfo.revision,
  isDirectChat: groupInfo.is_direct_chat,
  members: groupInfo.members.map((member: any) => {
    // Convert user_id to base58 format to match the allUsers API
    let memberId;
    if (Array.isArray(member.user_id)) {
      // Convert byte array to base58 using our custom function
      memberId = base58Encode(member.user_id);
    } else {
      memberId = member.user_id;
    }
    
    return {
      id: memberId,
      name: member.name,
      avatar: member.profile_pic || undefined,
      isOnline: member.is_online !== undefined ? member.is_online : member.state === 1, // Use backend is_online if available, fallback to state
      role: member.role,
      joinedAt: member.joined_at,
      state: member.state,
      lastMessageIndex: member.last_message_index,
      regNo: member.reg_no,
      college: member.college,
      profilePic: member.profile_pic,
      about: member.about,
    };
  }),
  unreadMessages: groupInfo.unread_messages,
  lastMessageAt: groupInfo.last_message_at,
  lastMessage: groupInfo.last_message,
  lastMessageSenderId: Array.isArray(groupInfo.last_message_sender_id)
    ? groupInfo.last_message_sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
    : groupInfo.last_message_sender_id,
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Real-time statistics state
  const [totalGroups, setTotalGroups] = useState(0);
  const [directChats, setDirectChats] = useState(0);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  
  // Message selection state
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Use refs to track if initial loads are complete
  const initialChannelsLoaded = useRef(false);
  const initialContactsLoaded = useRef(false);
  const initialInvitationsLoaded = useRef(false);

  // Update statistics based on current channels
  const updateStatistics = (channelList: Channel[]) => {
    const total = channelList.length;
    const direct = channelList.filter(ch => ch.isDirectChat).length;
    const unread = channelList.reduce((sum, ch) => sum + ch.unreadMessages, 0);
    
    setTotalGroups(total);
    setDirectChats(direct);
    setTotalUnreadMessages(unread);
  };

  // Smooth update function for channels - merges new data with existing
  const updateChannelsSmooth = (newChannels: Channel[]) => {
    setChannels(prevChannels => {
      // Create a map of existing channels
      const channelMap = new Map(prevChannels.map(ch => [ch.id, ch]));
      
      // Update or add new channels
      newChannels.forEach(newChannel => {
        channelMap.set(newChannel.id, newChannel);
      });
      
      // Convert back to array and sort
      const updatedChannels = Array.from(channelMap.values()).sort((a, b) => {
        const aTime = a.lastMessageAt || 0;
        const bTime = b.lastMessageAt || 0;
        return bTime - aTime;
      });
      
      // Update statistics with the latest channels
      updateStatistics(updatedChannels);
      
      return updatedChannels;
    });
  };

  // Update a single channel's properties
  const updateChannel = (channelId: string, updates: Partial<Channel>) => {
    setChannels(prevChannels => 
      prevChannels.map(channel => 
        channel.id === channelId 
          ? { ...channel, ...updates }
          : channel
      )
    );
  };

  // Smooth update function for contacts - merges without flickering
  const updateContactsSmooth = (newContacts: UserProfile[]) => {
    setContacts(prevContacts => {
      // Create a map of existing contacts
      const contactMap = new Map(prevContacts.map(c => [c.id, c]));
      
      // Update or add new contacts
      newContacts.forEach(newContact => {
        contactMap.set(newContact.id, newContact);
      });
      
      // Convert back to array
      return Array.from(contactMap.values());
    });
  };

  // Smooth update function for invitations
  const updateInvitationsSmooth = (newInvitations: GroupInvitation[]) => {
    setInvitations(prevInvitations => {
      // Create a map of existing invitations by group_id
      const invitationMap = new Map(
        prevInvitations.map(inv => [
          Array.isArray(inv.group.group_id) 
            ? inv.group.group_id.join(',') 
            : String(inv.group.group_id),
          inv
        ])
      );
      
      // Update or add new invitations
      newInvitations.forEach(newInv => {
        const key = Array.isArray(newInv.group.group_id) 
          ? newInv.group.group_id.join(',') 
          : String(newInv.group.group_id);
        invitationMap.set(key, newInv);
      });
      
      // Convert back to array
      return Array.from(invitationMap.values());
    });
  };

  // Load channels - now relies on background task updates only
  const refreshChannels = async () => {
    // Channels are updated automatically via background task 'groups-updated' events
    // No manual refresh needed - this function exists for compatibility only
    if (!initialChannelsLoaded.current) {
      // Set a timeout to prevent infinite loading state
      setTimeout(() => {
        if (!initialChannelsLoaded.current) {
          initialChannelsLoaded.current = true;
          setLoading(false);
        }
      }, 2000);
    }
  };

  // Load contacts with smooth updates (now handled by background service)
  const refreshContacts = async () => {
    // This function is now mainly for initial load
    // Background service handles continuous updates via users-updated event
    try {
      // Only show loading on initial load
      if (!initialContactsLoaded.current) {
        setContactsLoading(true);
      }
      
      const allUsersResponse = await invoke<string>('get_all_users');
      const allUsersData = JSON.parse(allUsersResponse);
      
      // Store all users for later use
      setAllUsers(allUsersData);
      
      // Convert to UserProfile format - handle both direct structure and nested base structure
      const convertedContacts: UserProfile[] = allUsersData.map((user: any) => {
        // Handle both direct properties and nested base structure
        const base = user.base || user;
        const userId = base.id || user.id;
        
        return {
          id: userId,
          name: base.name || user.name || 'Unknown User',
          avatar: base.profile || user.profile || user.profile_pic,
          profile_pic: base.profile || user.profile || user.profile_pic,
          profile: base.profile || user.profile || user.profile_pic,
          lastActive: user.last_seen || base.last_seen || user.lastActive || base.lastActive,
          last_seen: user.last_seen || base.last_seen,
          about: base.about || user.about || 'No bio available',
          status: user.status || base.status || 'Offline',
          blocked: base.blocked || user.blocked || false,
          college: base.college || user.college || 'Not specified',
          key_base58: base.key_base58 || user.key_base58,
          q8id: base.q8id || user.q8id,
          verified: base.verified || user.verified || false,
          connections: base.connections || user.connections || [],
          isOnline: user.is_online || base.is_online || false
        };
      });
      
      // Use smooth update instead of replacing all data
      updateContactsSmooth(convertedContacts);
      
      // Mark as loaded and turn off loading immediately after first successful load
      if (!initialContactsLoaded.current) {
        initialContactsLoaded.current = true;
        setContactsLoading(false);
      }
    } catch (error) {
      //console.error('Failed to load contacts:', error);
      // Still mark as loaded even on error to prevent infinite loading
      if (!initialContactsLoaded.current) {
        initialContactsLoaded.current = true;
        setContactsLoading(false);
      }
    }
  };

  // Load invitations with smooth updates (now handled by background service)
  const getPendingInvitations = async () => {
    // This function is now mainly for initial load
    // Background service handles continuous updates via invitations-updated event
    try {
      // Only show loading on initial load
      if (!initialInvitationsLoaded.current) {
        setInvitationsLoading(true);
      }
      
      const invitationList = await invoke<GroupInvitation[]>('get_pending_invitations');
      
      // Use smooth update instead of replacing all data
      updateInvitationsSmooth(invitationList);
      
      // Mark as loaded and turn off loading immediately after first successful load
      if (!initialInvitationsLoaded.current) {
        initialInvitationsLoaded.current = true;
        setInvitationsLoading(false);
      }
    } catch (error) {
      //console.error('Failed to load invitations:', error);
      // Still mark as loaded even on error to prevent infinite loading
      if (!initialInvitationsLoaded.current) {
        initialInvitationsLoaded.current = true;
        setInvitationsLoading(false);
      }
    }
  };

  // Unified background listening system for all real-time updates
  const setupUnifiedBackgroundListeners = async () => {
    console.log('Setting up unified background listeners...');
    
    // Error handler for listener failures
    const handleListenerError = (error: any, listenerType: string) => {
      console.error(`Error in ${listenerType} listener:`, error);
      // You could implement retry logic here or show user notifications
    };
    
    // Users/Contacts listener with enhanced error handling
    const unlistenUsers = await listen<string>('users-updated', (event) => {
      try {
        const allUsersData = JSON.parse(event.payload);
        console.log('Received users update:', allUsersData?.length, 'users');
        
        if (!Array.isArray(allUsersData)) {
          console.warn('Invalid users data format received:', typeof allUsersData);
          return;
        }
        
        // Convert to UserProfile format - handle both direct structure and nested base structure
        const convertedContacts: UserProfile[] = allUsersData.map((user: any) => {
          // Handle both direct properties and nested base structure
          const base = user.base || user;
          const userId = base.id || user.id;
          
          return {
            id: userId,
            name: base.name || user.name || 'Unknown User',
            avatar: base.profile || user.profile || user.profile_pic,
            profile_pic: base.profile || user.profile || user.profile_pic,
            profile: base.profile || user.profile || user.profile_pic,
            lastActive: user.last_seen || base.last_seen || user.lastActive || base.lastActive,
            last_seen: user.last_seen || base.last_seen,
            about: base.about || user.about || 'No bio available',
            status: user.status || base.status || 'Offline',
            blocked: base.blocked || user.blocked || false,
            college: base.college || user.college || 'Not specified',
            key_base58: base.key_base58 || user.key_base58,
            q8id: base.q8id || user.q8id,
            verified: base.verified || user.verified || false,
            connections: base.connections || user.connections || [],
            isOnline: user.is_online || base.is_online || false
          };
        });
        
        // Use smooth update instead of replacing all data
        updateContactsSmooth(convertedContacts);
        
        // Mark as loaded and turn off loading immediately after first successful load
        if (!initialContactsLoaded.current) {
          initialContactsLoaded.current = true;
          setContactsLoading(false);
          console.log('Contacts initial load completed');
        }
      } catch (error) {
        handleListenerError(error, 'users');
      }
    });
    
    // Groups/Channels listener with enhanced error handling
    const unlistenGroups = await listen<string>('groups-updated', (event) => {
      try {
        const groupsData = JSON.parse(event.payload);
        console.log('Received groups update:', groupsData?.length, 'groups');
        
        if (!Array.isArray(groupsData)) {
          console.warn('Invalid groups data format received:', typeof groupsData);
          return;
        }
        
        // Convert to Channel format
        const convertedChannels: Channel[] = groupsData.map((group: any) => ({
          id: Array.isArray(group.group_id) 
            ? group.group_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
            : String(group.group_id),
          name: group.group_name,
          type: group.is_direct_chat ? 'dm' : 'group',
          createdAt: group.created_at,
          status: group.status,
          revision: group.revision,
          isDirectChat: group.is_direct_chat,
          members: Array.isArray(group.members) ? group.members.map((member: any) => ({
            id: Array.isArray(member.user_id) 
              ? member.user_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
              : String(member.user_id),
            name: member.name || 'Unknown User',
            avatar: member.profile_pic,
            isOnline: member.is_online || member.state === 1,
            role: member.role || 0,
            joinedAt: member.joined_at || 0,
            state: member.state || 0,
            lastMessageIndex: member.last_message_index || 0,
            regNo: member.reg_no || '',
            college: member.college || '',
            profilePic: member.profile_pic,
            about: member.about || ''
          })) : [],
          unreadMessages: group.unread_messages || 0,
          lastMessageAt: group.last_message_at || 0,
          lastMessage: group.last_message || '',
          lastMessageSenderId: Array.isArray(group.last_message_sender_id) 
            ? group.last_message_sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
            : String(group.last_message_sender_id || '')
        }));
        
        // Use smooth update for channels
        updateChannelsSmooth(convertedChannels);
        
        // Mark as loaded immediately after first successful load
        if (!initialChannelsLoaded.current) {
          initialChannelsLoaded.current = true;
          setLoading(false);
          console.log('Channels initial load completed');
        }
      } catch (error) {
        handleListenerError(error, 'groups');
      }
    });
    
    // Invitations listener with enhanced error handling
    const unlistenInvitations = await listen<string>('invitations-updated', (event) => {
      try {
        const invitationsData = JSON.parse(event.payload);
        console.log('Received invitations update:', invitationsData?.length, 'invitations');
        
        if (!Array.isArray(invitationsData)) {
          console.warn('Invalid invitations data format received:', typeof invitationsData);
          return;
        }
        
        // Use smooth update instead of replacing all data
        updateInvitationsSmooth(invitationsData);
        
        // Mark as loaded and turn off loading immediately after first successful load
        if (!initialInvitationsLoaded.current) {
          initialInvitationsLoaded.current = true;
          setInvitationsLoading(false);
          console.log('Invitations initial load completed');
        }
      } catch (error) {
        handleListenerError(error, 'invitations');
      }
    });
    
    // Connection status listener (optional - for monitoring background service health)
    const unlistenConnectionStatus = await listen<string>('connection-status', (event) => {
      try {
        const status = JSON.parse(event.payload);
        
        // You can add connection status handling here if needed
        // For example: show offline indicator, retry failed connections, etc.
        if (status.connected === false) {
          console.warn('Background service disconnected - some features may be limited');
        }
      } catch (error) {
        handleListenerError(error, 'connection-status');
      }
    });
    
    
    // Return unified cleanup function
    return () => {
      unlistenUsers();
      unlistenGroups();
      unlistenInvitations();
      unlistenConnectionStatus();
    };
  };

  // Initialize unified background listeners and message polling
  useEffect(() => {
    
    // Initial data load
    refreshChannels();
    refreshContacts();
    getPendingInvitations();
    
    // Setup unified background listeners
    const setupBackgroundSystems = async () => {
      const cleanupListeners = await setupUnifiedBackgroundListeners();
      
      // Message polling for current channel (keep existing logic)
      const messageInterval = setInterval(() => {
        if (currentChannel) {
          let groupId: string;
          
          if (typeof currentChannel.id === 'string') {
              groupId = currentChannel.id;
            } else if (Array.isArray(currentChannel.id)) {
              groupId = (currentChannel.id as number[]).map((b: number) => b.toString(16).padStart(2, '0')).join('');
            } else {
              groupId = String(currentChannel.id);
            }
          // Only refresh messages if we have a valid group ID
          if (groupId && /^[0-9a-fA-F]+$/.test(groupId) && groupId.length % 2 === 0) {
            getMessages(groupId);
          }
        }
      }, 1000);
      
      return () => {
        cleanupListeners();
        clearInterval(messageInterval);
      };
    };
    
    const cleanup = setupBackgroundSystems();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn());
    };
  }, [currentChannel]);

  const createGroup = async (name: string) => {
    try {
      await invoke('create_group', { name });
      // Groups will be updated automatically via background task
    } catch (error) {
      //console.error('Failed to create group:', error);
      throw error;
    }
  };

  const createDirectChat = async (userId: string) => {
    try {
      await invoke('create_direct_chat', { remoteUserId: userId });
      // Groups will be updated automatically via background task
    } catch (error) {
      //console.error('Failed to create direct chat:', error);
      throw error;
    }
  };

  const inviteToGroup = async (groupId: string, userId: string) => {
    try {
      const groupIdBytes = groupId.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || [];
      await invoke('invite_user_to_group', { groupId: groupIdBytes, userId });
      // Groups will be updated automatically via background task
    } catch (error) {
      //console.error('Failed to invite user to group:', error);
      throw error;
    }
  };

  const leaveGroup = async (groupId: string) => {
    try {
      // First, get all messages in the group to delete them
      const currentChannelData = channels.find(ch => ch.id === groupId);
      if (currentChannelData && !currentChannelData.isDirectChat) {
        // For groups, clear messages but don't delete the group completely
        try {
          const response = await invoke('get_messages', { groupId }) as string;
          const data = JSON.parse(response);
          const messageIds = data.message_list.map((msg: any) => msg.message_id);
          
          if (messageIds.length > 0) {
            await invoke('delete_messages', { messageIds });
          }
        } catch (error) {
          console.warn('Failed to clear messages when leaving group:', error);
        }
      }
      
      // Leave the group
      await invoke('leave_group', { groupId });
      await refreshChannels();
      
      if (currentChannel?.id === groupId) {
        setCurrentChannel(null);
        setMessages([]); // Clear messages from state
      }
    } catch (error) {
      //console.error('Failed to leave group:', error);
      throw error;
    }
  };

  const replyToInvitation = async (groupId: string, accept: boolean) => {
    try {
      await invoke('reply_to_group_invitation', { groupId, accept });
      
      // Don't manually refresh - let the background service handle the update
      // The background service should emit 'invitations-updated' event automatically
      // Add a small delay to allow background service to process the change
      setTimeout(async () => {
        // Only refresh if the background service hasn't updated within 2 seconds
        const invitation = invitations.find(inv => {
          const invGroupId = Array.isArray(inv.group.group_id) 
            ? inv.group.group_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
            : String(inv.group.group_id);
          return invGroupId === groupId;
        });
        
        // If invitation still exists after 2 seconds, manually refresh
        if (invitation) {
          await getPendingInvitations();
        }
      }, 2000);
      
      // If accepted, try to join the group
      if (accept) {
        // Wait a bit for the background service to update channels
        setTimeout(() => {
          const newChannel = channels.find(ch => ch.id === groupId);
          if (newChannel) {
            setCurrentChannel(newChannel);
            setCurrentView('chat');
          }
        }, 1000);
      }
    } catch (error) {
      //console.error('Failed to reply to invitation:', error);
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    if (!currentChannel) return;
    
    try {
      await invoke('send_message', {
        groupId: currentChannel.id,
        message: content,
        fileData: null,
      });
      // Groups will be updated automatically via background task
    } catch (error) {
      //console.error('Failed to send message:', error);
      throw error;
    }
  };

  const sendFile = async (file: File, description?: string) => {
    if (!currentChannel) return;
    
    try {
      // Read file as base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      
      // Extract base64 content (remove data URL prefix)
      const base64Content = fileContent.split(',')[1];
      
      const fileData = {
        name: file.name,
        description: description || '',
        extension: file.name.split('.').pop() || '',
        size: file.size,
        content: base64Content,
      };
      
      await invoke('send_message', {
        groupId: currentChannel.id,
        message: null,
        fileData,
      });
      
      // Groups will be updated automatically via background task
    } catch (error) {
      //console.error('Failed to send file:', error);
      throw error;
    }
  };

  const getMessages = async (groupId: string): Promise<any> => {
    try {
      const response = await invoke('get_messages', { groupId }) as string;
      const data = JSON.parse(response);
      
      // Create a map of file IDs to file information for easy lookup
      const fileMap = new Map();
      if (data.files) {
        data.files.forEach((file: any) => {
          const fileIdStr = Array.isArray(file.file_id) 
            ? file.file_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
            : file.file_id;
          fileMap.set(fileIdStr, file);
        });
      }
      
      // Convert the fetched messages to the Message interface format
      const convertedMessages: Message[] = data.message_list.map((msg: any) => {
        // Handle group events differently - show as system messages
        if (msg.message_type === 'system') {
          return {
            id: msg.message_id,
            content: msg.content,
            senderId: msg.sender_id,
            senderName: msg.sender_name,
            message_type: 'system',
            timestamp: new Date(msg.sent_at),
            isOwn: false,
            status: 'delivered' as const,
          };
        }
        
        // Extract sender avatar from sender profile if available
        let senderAvatar = undefined;
        if (msg.sender_profile && msg.sender_profile.profile_pic) {
          senderAvatar = msg.sender_profile.profile_pic;
        }

        let senderCollege = undefined;
        if (msg.sender_profile && msg.sender_profile.college) {
          senderCollege = msg.sender_profile.college;
        }
        
        // Regular messages
        let messageContent = msg.content;
        let messageType = 'text';
        let fileInfo: any = null;
        
        // Handle file messages
        if (msg.message_type === 'file') {
          messageType = 'file';
          
          // Try multiple approaches to find matching file info
          let matchingFile = null;
          
          // Method 1: Find matching file by sender_id and timestamp (existing logic)
          matchingFile = data.files?.find((file: any) => {
            const msgSenderIdStr = Array.isArray(msg.sender_id) 
              ? msg.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
              : msg.sender_id;
            const fileSenderIdStr = Array.isArray(file.sender_id) 
              ? file.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
              : file.sender_id;
            
            return fileSenderIdStr === msgSenderIdStr && 
                   Math.abs(file.sent_at - msg.sent_at) < 1000;
          });
          
          // Method 2: If not found, try matching by message index and sender
          if (!matchingFile && msg.index !== undefined) {
            matchingFile = data.files?.find((file: any) => {
              const msgSenderIdStr = Array.isArray(msg.sender_id) 
                ? msg.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
                : msg.sender_id;
              const fileSenderIdStr = Array.isArray(file.sender_id) 
                ? file.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
                : file.sender_id;
              
              return fileSenderIdStr === msgSenderIdStr && 
                     Math.abs(file.sent_at - msg.sent_at) < 5000; // Larger time window
            });
          }
          
          // Method 3: If still not found, try finding the closest file by timestamp for the same sender
          if (!matchingFile) {
            const senderFiles = data.files?.filter((file: any) => {
              const msgSenderIdStr = Array.isArray(msg.sender_id) 
                ? msg.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
                : msg.sender_id;
              const fileSenderIdStr = Array.isArray(file.sender_id) 
                ? file.sender_id.map((b: number) => b.toString(16).padStart(2, '0')).join('')
                : file.sender_id;
              
              return fileSenderIdStr === msgSenderIdStr;
            });
            
            if (senderFiles && senderFiles.length > 0) {
              // Find the file with timestamp closest to the message
              matchingFile = senderFiles.reduce((closest: any, file: any) => {
                const msgTimeDiff = Math.abs(file.sent_at - msg.sent_at);
                const closestTimeDiff = Math.abs(closest.sent_at - msg.sent_at);
                return msgTimeDiff < closestTimeDiff ? file : closest;
              });
            }
          }
          
          if (matchingFile) {
            messageContent = matchingFile.file_name;
            fileInfo = matchingFile;
          } else {
            messageContent = 'Shared file';
          }
        }
        
        return {
          id: msg.message_id,
          content: messageContent,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          senderCollege,
          senderAvatar,
          timestamp: new Date(msg.sent_at),
          isOwn: msg.is_current_user,
          message_type: messageType,
          status: (() => {
            switch(msg.status) {
              case 0: return 'sending';
              case 1: return 'sent';
              case 2: return 'confirmed';
              case 3: return 'confirmed_by_all';
              case 4: return 'receiving';
              case 5: return 'received';
              default: return 'sent';
            }
          })(),
          ...(messageType === 'file' && fileInfo && { 
            fileInfo: {
              fileName: fileInfo.file_name,
              filePath: fileInfo.file_path,
              fileSize: fileInfo.file_size,
              fileExtension: fileInfo.file_extension,
              fileId: fileInfo.file_id,
              fileDescription: fileInfo.file_description
            }
          })
        };
      });
      
      // Smooth merge with existing messages
      setMessages(prevMessages => {
        const existingMessageIds = new Set(prevMessages.map(msg => msg.id));
        const newMessages = convertedMessages.filter(msg => !existingMessageIds.has(msg.id));
        const allMessages = [...prevMessages, ...newMessages];
        
        return allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      });
      
      return {
        ...data,
        messages: convertedMessages,
        files: data.files || []
      };
    } catch (error) {
      //console.error('Failed to get messages:', error);
      throw error;
    }
  };

  // Delete specific messages by their IDs
  const deleteMessages = async (messageIds: string[]) => {
    try {
      await invoke('delete_messages', { messageIds });
      
      // Remove messages from local state
      setMessages(prevMessages => 
        prevMessages.filter(msg => !messageIds.includes(msg.id))
      );
      
      // Update unread count for the current channel if it's affected
      if (currentChannel) {
        updateChannel(currentChannel.id, {
          unreadMessages: Math.max(0, (currentChannel.unreadMessages || 0) - messageIds.length)
        });
      }
    } catch (error) {
      console.error('Failed to delete messages:', error);
      throw error;
    }
  };

  // Delete all messages in a specific group
  const deleteAllGroupMessages = async (groupId: string) => {
    try {
      setDeleteLoading(true);
      await invoke('delete_all_group_messages', { groupId });
      
      // Clear messages from local state if this is the current channel
      if (currentChannel && currentChannel.id === groupId) {
        setMessages([]);
        // Set current channel to null after successful deletion
        setCurrentChannel(null);
      }
      
      // Groups will be updated automatically via background task
    } catch (error) {
      console.error('Failed to delete all group messages:', error);
      throw error;
    } finally {
      setDeleteLoading(false);
    }
  };

  // Refresh statistics function for Dashboard
  const refreshStats = () => {
    updateStatistics(channels);
  };

  // Message selection management functions
  const toggleMessageSelection = (messageId: string) => {
    console.log('Toggle message selection called for:', messageId);
    setSelectedMessages(prev => {
      const newSelection = new Set(prev);
      const wasSelected = newSelection.has(messageId);
      
      if (wasSelected) {
        newSelection.delete(messageId);
        console.log('Message deselected, new count:', newSelection.size);
        // If no messages selected, disable selection mode
        if (newSelection.size === 0) {
          setIsSelectionMode(false);
          console.log('Selection mode disabled');
        }
      } else {
        newSelection.add(messageId);
        console.log('Message selected, new count:', newSelection.size);
        // Enable selection mode when first message is selected
        if (prev.size === 0) {
          setIsSelectionMode(true);
          console.log('Selection mode enabled');
        }
      }
      return newSelection;
    });
  };

  const clearMessageSelection = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  return (
    <ChatContext.Provider
      value={{
        currentView,
        setCurrentView,
        currentChannel,
        setCurrentChannel,
        channels,
        messages,
        setMessages,
        contacts,
        allUsers,
        invitations,
        sendMessage,
        sendFile,
        getMessages,
        searchTerm,
        setSearchTerm,
        refreshChannels,
        updateChannel,
        createGroup,
        createDirectChat,
        inviteToGroup,
        leaveGroup,
        refreshContacts,
        getPendingInvitations,
        replyToInvitation,
        deleteMessages,
        deleteAllGroupMessages,
        loading,
        contactsLoading,
        invitationsLoading,
        deleteLoading,
        // Real-time statistics for Dashboard
        totalGroups,
        directChats,
        totalUnreadMessages,
        refreshStats,
        // Message selection for multi-select delete
        selectedMessages,
        toggleMessageSelection,
        clearMessageSelection,
        isSelectionMode,
        setIsSelectionMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  } 
  return context;
}
