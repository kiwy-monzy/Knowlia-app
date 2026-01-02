import { useState, useEffect } from 'react';
import { Search, MessageSquare, ArrowLeft, CheckCircle, Shield, Ban, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import NoContent from '@/components/NoContent';

const ContactsPage = () => {
  const { contacts, setCurrentView, contactsLoading, channels, setCurrentChannel } = useChatContext();
  const [searchQuery, setSearchQuery] = useState('');

  const handleStartChat = async (contactId: string) => {
    try {
      // Check if a direct chat already exists
      const existingChannel = channels.find(channel => 
        channel.isDirectChat && 
        channel.members.some(member => member.id === contactId)
      );

      if (existingChannel) {
        // If chat exists, navigate to it
        setCurrentChannel(existingChannel);
      } else {
        // If no chat exists, create one
        await invoke<string>('get_or_create_direct_chat', { contactId });
        
        // Refresh channels to get the new group
        // The ChatContext automatically refreshes every second, so no manual refresh needed
      }
      
      // Don't change view - stay on contacts page
      // User can manually navigate to chat if they want to
    } catch (error) {
      //console.error('Failed to start chat:', error);
    }
  };

  const handleVerifyUser = async (contactId: string) => {
    try {
      await invoke<string>('qaul_send_command', { command: `users verify ${contactId}` });
      console.log(`Verification command sent for user: ${contactId}`);
    } catch (error) {
      console.error('Failed to verify user:', error);
    }
  };

  const handleBlockUser = async (contactId: string) => {
    try {
      await invoke<string>('qaul_send_command', { command: `users block ${contactId}` });
      console.log(`Block command sent for user: ${contactId}`);
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  };



  const formatLastActive = (timestamp?: number | null) => {
    if (!timestamp) return 'Recently';
    const now = new Date();
    const date = new Date(timestamp * 1000); // Convert from Unix timestamp
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group contacts by first letter
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const letter = contact.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, typeof contacts>);

  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="h-12 px-6 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={() => setCurrentView('chat')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-display text-xl font-bold text-foreground">Contacts</h1>
        <span className="text-sm text-muted-foreground">
          {contactsLoading ? 'Loading...' : `${contacts.length} people`}
        </span>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="py-2 pb-8 md:pb-12 lg:pb-16">
          {contactsLoading ? (
            <NoContent title="LOADING" className="h-64" />
          ) : sortedLetters.length > 0 ? (
            sortedLetters.map(letter => (
              <div key={letter}>
                <div className="px-6 py-2 sticky top-0 bg-background/95 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-primary uppercase">
                    {letter}
                  </span>
                </div>

                {groupedContacts[letter].map(contact => {
                  return (
                  <div
                    key={contact.id}
                    className="w-full flex items-center gap-3 px-6 py-3 hover:bg-muted/50  group cursor-pointer"
                    onClick={() => handleStartChat(contact.id)}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-background rounded-2xl">
                        <img 
                          src={contact.profile || contact.avatar || contact.profile_pic}
                          alt={contact.name}
                          className="w-full h-full object-cover rounded-2xl"
                          onError={(e) => {
                            // Fallback to default avatar on error
                            const target = e.target as HTMLImageElement;
                            target.src = '/default-avatar.png';
                          }}
                        />
                      </Avatar>
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background',
                          contact.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        )}
                      />
                      {contact.verified && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {contact.name}
                          </span>
                          {contact.verified && (
                            <span title="Verified User">
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {contact.isOnline ? (
                            <span className="text-chat-online">Online</span>
                          ) : (
                            formatLastActive(contact.last_seen || contact.lastActive)
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.about || ''}
                        </p>
                        {contact.college && contact.college !== 'Not specified' && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {contact.college}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 opacity-0 group-hover:opacity-100  -opacity text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartChat(contact.id);
                            }}
                            className="gap-2"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Start Chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          ) : (
            <NoContent title="EMPTY" className="h-64" />
          )}

          {!contactsLoading && filteredContacts.length === 0 && contacts.length > 0 && (
            <NoContent title="NO RESULTS" className="h-64" />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ContactsPage;