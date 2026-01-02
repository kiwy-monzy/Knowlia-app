import React, { useState, useMemo } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Calendar, 
  MessageSquare, 
  User, 
  Hash,
  Clock,
  ChevronRight,
  Eye
} from 'lucide-react';
import { MeshGradient } from "@paper-design/shaders-react";

interface ChatHistoryProps {
  onChannelSelect?: (channelId: string) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ onChannelSelect }) => {
  const { channels, messages } = useChatContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'dms'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'messageCount'>('recent');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  // Filter and sort channels
  const filteredChannels = useMemo(() => {
    let filtered = channels;

    // Filter by type
    if (filterType === 'groups') {
      filtered = filtered.filter(ch => ch.type === 'group');
    } else if (filterType === 'dms') {
      filtered = filtered.filter(ch => ch.type === 'dm');
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(ch => 
        ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ch.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort channels
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'messageCount':
          return (b.unreadMessages || 0) - (a.unreadMessages || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [channels, filterType, searchTerm, sortBy]);

  // Get messages for selected channel
  const channelMessages = useMemo(() => {
    if (!selectedChannel) return [];
    // TODO: Filter messages by channel ID when channel linking is implemented
    return messages;
  }, [selectedChannel, messages]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getTotalMessageCount = () => {
    return messages.length;
  };

  const getUnreadCount = () => {
    return channels.reduce((total, channel) => total + (channel.unreadMessages || 0), 0);
  };

  return (
    <div className="flex h-full">
      {/* Channels List */}
      <div className={`${selectedChannel ? 'w-1/3' : 'w-full'} border-r border-border  duration-300`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Chat History</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>{getTotalMessageCount()}</span>
              {getUnreadCount() > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {getUnreadCount()}
                </Badge>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <Select value={filterType} onValueChange={(value: 'all' | 'groups' | 'dms') => setFilterType(value)}>
              <SelectTrigger className="flex-1" aria-label="Filter chat type">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chats</SelectItem>
                <SelectItem value="groups">Groups</SelectItem>
                <SelectItem value="dms">Direct Messages</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: 'recent' | 'name' | 'messageCount') => setSortBy(value)}>
              <SelectTrigger className="flex-1" aria-label="Sort chats">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="messageCount">Messages</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Channels List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No chats found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              filteredChannels.map((channel) => (
                <Card 
                  key={channel.id}
                  className={`mb-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedChannel === channel.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                    <MeshGradient
                      speed={0.5}
                      colors={["#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0"]}
                      distortion={0.4}
                      swirl={0.05}
                      grainMixer={0}
                      grainOverlay={0}
                      className="inset-0 sticky top-0"
                      style={{ height: "100%", width: "100%" }}
                    />
                  </div>
                  <CardContent className="relative z-10 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {channel.type === 'group' ? (
                            <Hash className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                          <h3 className="font-medium truncate">{channel.name}</h3>
                          {channel.unreadMessages > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {channel.unreadMessages}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {channel.lastMessageAt ? formatDate(channel.lastMessageAt) : 'No messages'}
                          </span>
                          {channel.lastMessageAt && (
                            <>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(channel.lastMessageAt)}</span>
                            </>
                          )}
                        </div>

                        {channel.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {channel.lastMessage}
                          </p>
                        )}

                        {channel.members && channel.members.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <div className="flex -space-x-1">
                              {channel.members.slice(0, 3).map((member, idx) => (
                                <div
                                  key={idx}
                                  className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"
                                  title={member.name}
                                >
                                  <span className="text-xs">
                                    {member.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {channel.members.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{channel.members.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Channel Messages Detail */}
      {selectedChannel && (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {channels.find(ch => ch.id === selectedChannel)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {channelMessages.length} messages
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChannel(null)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Back to List
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {channelMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages in this chat</p>
                </div>
              ) : (
                channelMessages.map((message) => (
                  <Card key={message.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">
                          {message.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{message.senderName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp.getTime())}
                          </span>
                          {message.isOwn && (
                            <Badge variant="secondary" className="text-xs">You</Badge>
                          )}
                        </div>
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
