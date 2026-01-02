import { useChatContext } from '@/contexts/ChatContext';
import ChatArea from '@/components/chat/ChatArea';
import ContactsPage from '@/components/chat/ContactsPage';
import RequestPage from '@/components/chat/RequestPage';
import ChatSidebar from '@/components/chat/ChatSidebar';
import VideoCall from '@/components/chat/VideoCall';
import VoiceCall from '@/components/chat/VoiceCall';
import { useRTC } from '@/hooks/useRTC';

function ChatContent() {
  const { currentView, currentChannel } = useChatContext();
  const { activeSessions, refreshSessions } = useRTC({ autoInitialize: true });

  const renderContent = () => {
    // Show requests page if explicitly requested
    if (currentView === 'requests') return <RequestPage />;
    // Show contacts page if no current channel is selected
    if (!currentChannel) return <ContactsPage />;
    // Show contacts page if explicitly requested
    if (currentView === 'contacts') return <ContactsPage />;
    // Otherwise show chat area
    return <ChatArea />;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block h-full bg-[#fafafa] relative">
        <ChatSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {renderContent()}
      </div>

      {/* RTC Overlays */}
      {activeSessions.map(session => (
        session.state === 3 && (
          session.session_type === 1 ? (
            <VoiceCall 
              key={session.group_id} 
              session={session} 
              onClose={() => refreshSessions()} 
            />
          ) : (session.session_type === 2 || session.session_type === 3) ? (
            <VideoCall 
              key={session.group_id} 
              session={session} 
              onClose={() => refreshSessions()} 
            />
          ) : null
        )
      ))}
    </div>
  );
}

export default ChatContent;