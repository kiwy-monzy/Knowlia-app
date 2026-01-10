import { useRef, useLayoutEffect, useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';
import MessageInput from './MessageInput';
import InfoSidebar from './InfoSidebar';
import NoContent from '@/components/NoContent';
import { MessageCircle } from 'lucide-react';

const ChatArea = () => {
  const { messages, currentChannel, searchTerm, updateChannel } = useChatContext();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const prevChannelIdRef = useRef<string | null>(null);

  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showMembersTab, setShowMembersTab] = useState(false);


  /* -------------------- ONE SCROLL FUNCTION -------------------- */

  const scrollToLastMessage = () => {
    if (!lastMessageRef.current) return;

    requestAnimationFrame(() => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    });
  };

  /* -------------------- ONE EFFECT (NO GLITCH) -------------------- */

  useLayoutEffect(() => {
    if (!currentChannel?.id) return;

    const channelChanged = prevChannelIdRef.current !== currentChannel.id;
    prevChannelIdRef.current = currentChannel.id;

    // Always scroll on channel change or when messages load/update
    scrollToLastMessage();
  }, [currentChannel?.id, messages.length]);

  /* -------------------- UI HANDLERS -------------------- */

  const handleToggleInfo = () => {
    setShowMembersTab(false);
    setShowInfoSidebar(prev => !prev);
  };

  const handleToggleMembers = () => {
    setShowMembersTab(true);
    setShowInfoSidebar(true);
  };

  /* -------------------- EMPTY STATE -------------------- */

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <MessageCircle className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Select a conversation
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose a chat to start messaging
          </p>
        </div>
      </div>
    );
  }

  /* -------------------- FILTER + GROUP -------------------- */

  const filteredMessages = searchTerm
    ? messages.filter(m =>
        m.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : messages;

  const groupMessagesByDate = (msgs: typeof messages) => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = msg.timestamp.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(filteredMessages);

  /* -------------------- RENDER -------------------- */

  return (
    <div className="flex-1 flex h-full bg-background overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          onToggleInfo={handleToggleInfo}
          onToggleMembers={handleToggleMembers}
        />

        <div className="flex-1 mb-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="h-full overflow-y-auto px-2"
          >
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                <div className="flex justify-center  mb-4">
                  <div className="px-3 py-1 rounded-full bg-muted text-xs">
                    {group.date}
                  </div>
                </div>

                {group.messages.map((message, index) => {
                  const isLastMessage =
                    groupIndex === messageGroups.length - 1 &&
                    index === group.messages.length - 1;

                  // Generate a unique key for each message
                  const messageKey = message.id || `${groupIndex}-${index}-${message.timestamp.getTime()}`;

                  return (
                    <div
                      key={messageKey}
                      ref={isLastMessage ? lastMessageRef : undefined}
                    >
                      <ChatMessage
                        message={message}
                        previousMessage={
                          index > 0
                            ? group.messages[index - 1]
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Nice empty state using NoContent component */}
            {filteredMessages.length === 0 && !searchTerm && (
              <NoContent 
                title="Start the Conversation"
                className="py-16"
              >
                <p className="text-center">
                  Say hello to {currentChannel?.name || 'this channel'}! Your first message will appear here.
                </p>
              </NoContent>
            )}

            {filteredMessages.length === 0 && searchTerm && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No messages found for "{searchTerm}"
              </div>
            )}
          </div>
        </div>

        <div className="pb-14">
          <MessageInput />
        </div>
      </div>

      <InfoSidebar
        isOpen={showInfoSidebar}
        onClose={() => setShowInfoSidebar(false)}
        showMembers={showMembersTab}
      />

    </div>
  );
};

export default ChatArea;
