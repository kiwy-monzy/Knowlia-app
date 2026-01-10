import { useState } from 'react';
import { 
  Hash, 
  Users, 
  MessageCircle, 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  User,
  Phone,
  Video,
  Sparkles,
  Bell,
  Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext, Channel } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import SidebarHeader from '@/components/SidebarHeader';
import FormButton from '@/components/FormButton';

const ChatSidebar = () => {
  const { channels, currentChannel, setCurrentChannel, setCurrentView, getMessages, setMessages, createGroup, invitations, invitationsLoading } = useChatContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    groups: true,
  });

  const handleCreateGroup = async (formData: Record<string, string>) => {
    const groupName = formData.groupName;
    if (groupName.trim()) {
      try {
        await createGroup(groupName.trim());
      } catch (error) {
        console.error('Failed to create group:', error);
      }
    }
  };



  const dms = channels.filter(c => c.type === 'dm');
  const groups = channels.filter(c => c.type === 'group');

  const filteredDms = dms.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = groups.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (section: 'dms' | 'groups') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp * 1000); // Convert from Unix timestamp
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'now';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const ChannelItem = ({ channel }: { channel: Channel }) => {
    const isActive = currentChannel?.id === channel.id;

    const handleChannelClick = async () => {
      try {
        // Clear previous messages before loading new ones
        setMessages([]);
       console.log(channels);
        // Debug: Log the original channel ID
        console.log('Original channel ID:', channel.id, typeof channel.id);
        
        // Ensure the group ID is a string (hex format)
        let groupId: string;
        if (typeof channel.id === 'string') {
          groupId = channel.id;
        } else if (Array.isArray(channel.id)) {
          groupId = (channel.id as number[]).map((b: number) => b.toString(16).padStart(2, '0')).join('');
        } else {
          groupId = String(channel.id);
        }
        
       console.log('Processed group ID:', groupId);
        //console.log('Group ID length:', groupId.length);
        //console.log('Group ID is valid hex:', /^[0-9a-fA-F]+$/.test(groupId));
        
        // Validate hex format
        if (!/^[0-9a-fA-F]+$/.test(groupId)) {
          throw new Error(`Invalid group ID format: "${groupId}". Expected hex characters only.`);
        }
        
        // Ensure even length for hex (each byte = 2 hex chars)
        if (groupId.length % 2 !== 0) {
          throw new Error(`Invalid group ID length: ${groupId}. Must be even number of characters.`);
        }
        
        //console.log('Group ID validation passed, calling getMessages...');
        
        // Load messages for this channel
        await getMessages(groupId);
        
        // Set the current channel and switch to chat view
        setCurrentChannel(channel);
        setCurrentView('chat');
      } catch (error) {
        //console.error('Failed to load messages:', error);
        //console.error('Error details:', error instanceof Error ? error.message : String(error));
        // Still set the channel even if message loading fails
        setCurrentChannel(channel);
        setCurrentView('chat');
      }
    };

    return (
      <button
        onClick={handleChannelClick}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg   duration-200 group',
          isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'hover:bg-muted/80 text-foreground'
        )}
      >
        <div className="relative flex-shrink-0">
          {channel.type === 'dm' ? (
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-background rounded-2xl">
                {channel.members && channel.members.length > 0 && channel.members[0].profilePic ? (
                  <img 
                    src={channel.members[0].profilePic.startsWith('data:image') ? channel.members[0].profilePic : `data:image/jpeg;base64,${channel.members[0].profilePic}`}
                    alt={channel.name}
                    className="w-full h-full object-cover rounded-2xl"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <AvatarFallback 
                  className={cn(
                    'h-full w-full text-sm font-semibold rounded-2xl',
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-gradient-to-br from-muted to-muted/50 text-muted-foreground'
                  )} 
                  style={{ display: channel.members && channel.members.length > 0 && channel.members[0].profilePic ? 'none' : 'flex' }}
                >
                  {getInitials(channel.name)}
                </AvatarFallback>
              </Avatar>
              

              
              {/* Active Call Indicator */}
              {channel.hasActiveCall && (
                <span className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center ring-2 ring-background">
                  {channel.activeCallType === 'video' ? (
                    <Video className="h-2.5 w-2.5 text-white" />
                  ) : (
                    <Phone className="h-2.5 w-2.5 text-white" />
                  )}
                </span>
              )}
            </div>
          ) : (
            <div className={cn(
              'h-12 w-12 rounded-2xl flex items-center justify-center  ',
              isActive 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-gradient-to-br from-muted to-muted/50 text-muted-foreground'
            )}>
              <Hash className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className={cn(
                'font-medium truncate text-xs',
                channel.unreadMessages && Number(channel.unreadMessages) > 0 && 'font-semibold'
              )}>
                {channel.name}
              </span>
              {channel.hasActiveCall && (
                <span className="flex-shrink-0 text-[9px] font-medium text-primary bg-primary/10 px-1 py-0.5 rounded-full">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {formatTime(channel.lastMessageAt)}
              </span>
              {Number(channel.unreadMessages) > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                  {channel.unreadMessages}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1 mt-0.5 min-w-0">
            <p className="text-[10px] text-muted-foreground truncate flex-1 min-w-0 flex items-center gap-1">
              {channel.lastMessage === '<file message>' ? (
                <>
                  <Paperclip className="h-3 w-3" />
                  <span>File</span>
                </>
              ) : channel.lastMessage === '<empty message>' ? (
                <>
                  <MessageCircle className="h-3 w-3" />
                  <span>No messages yet</span>
                </>
              ) : channel.lastMessage?.length > 30 ? (
                <>
                  <MessageCircle className="h-3 w-3" />
                  <span>{`${channel.lastMessage.substring(0, 30)}...`}</span>
                </>
              ) : (
                <>
                  <MessageCircle className="h-3 w-3" />
                  <span>{channel.lastMessage || 'No messages'}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="w-[260px] h-screen flex flex-col bg-chat-sidebar rounded-l-[2rem] rounded-bl-[2rem] border-r border-sidebar-border bg">
      {/* Header */}
      <SidebarHeader 
        title="Chats" 
        Icon={Sparkles}
        action={
          <FormButton
            title="Create New Group"
            description="Enter a name for your new group chat."
            fields={[
              {
                id: 'groupName',
                name: 'groupName',
                label: 'GROUP NAME',
                type: 'text',
                placeholder: 'Enter group name...',
                required: true
              }
            ]}
            onSubmit={handleCreateGroup}
            submitButtonText="Create Group"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-muted/50 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="p-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setCurrentView('contacts')}
        >
          <User className="h-4 w-4" />
          Contacts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setCurrentView('requests')}
        >
          <div className="relative">
            <Bell className="h-4 w-4" />
            {!invitationsLoading && invitations.length > 0 && (
              <span className="absolute -top-1 -right-1 h-3 min-w-3 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                {invitations.length > 9 ? '9+' : invitations.length}
              </span>
            )}
          </div>
          Requests
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted hidden"
          onClick={async () => {
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              await invoke('start_str0m_server');
              console.log('Signaling server started on port 3000');
            } catch (e) {
              console.error('Failed to start signaling server:', e);
            }
          }}
        >
          <Video className="h-4 w-4" />
          Start Signaling Server
        </Button>
      </div>

      {/* Channels List */}
      <ScrollArea className="flex-1 px-1">
        <div className="py-2 pb-8">
          {/* Direct Messages Section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('dms')}
              className="flex items-center gap-1 px-1.5 py-1.5 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground   rounded-lg"
            >
              {expandedSections.dms ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Direct Messages</span>
              {dms.some(d => d.hasActiveCall) && (
                <span className="ml-auto h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </button>

            {expandedSections.dms && (
              <div className="mt-0.5 space-y-0.5 animate-fade-in">
                {filteredDms.map(channel => (
                  <ChannelItem key={channel.id} channel={channel} />
                ))}
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div>
            <button
              onClick={() => toggleSection('groups')}
              className="flex items-center gap-1 px-1.5 py-1.5 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground   rounded-lg"
            >
              {expandedSections.groups ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Users className="h-3.5 w-3.5" />
              <span>Groups</span>
              {groups.some(g => g.hasActiveCall) && (
                <span className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>

            {expandedSections.groups && (
              <div className="mt-0.5 space-y-0.5 animate-fade-in">
                {filteredGroups.map(channel => (
                  <ChannelItem key={channel.id} channel={channel} />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatSidebar;
