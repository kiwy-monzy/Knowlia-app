import React, { useEffect, useState } from 'react';
import { rtcService, RtcSession } from '@/utils/rtc';
import { X, Mic, MicOff, PhoneOff, Maximize2, Minimize2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceCallProps {
  session: RtcSession;
  onClose: () => void;
}

const VoiceCall: React.FC<VoiceCallProps> = ({ session, onClose }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [duration, setDuration] = useState(0);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // In a real implementation, we would also mute the actual audio track
  };

  const handleEndCall = async () => {
    try {
      await rtcService.endCall(session.group_id);
      onClose();
    } catch (err) {
      console.error('Failed to end call:', err);
    }
  };

  if (session.state !== 3) return null;

  return (
    <div 
      className={cn(
        "fixed transition-all duration-300 shadow-2xl z-[100] bg-background border border-border overflow-hidden",
        isMinimized 
          ? "bottom-4 right-4 w-64 h-20 rounded-2xl flex items-center px-4" 
          : "bottom-24 right-8 w-72 h-80 rounded-3xl flex flex-col items-center justify-between py-8"
      )}
    >
      {/* Header Info (only in expanded) */}
      {!isMinimized && (
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Secure Call</span>
          </div>
          <button 
            onClick={() => setIsMinimized(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Avatar / Profile section */}
      <div className={cn("flex items-center", isMinimized ? "gap-3 flex-1" : "flex-col gap-4 mt-4")}>
        <div className={cn(
          "rounded-full bg-primary/10 flex items-center justify-center transition-all",
          isMinimized ? "w-10 h-10" : "w-24 h-24"
        )}>
          <Phone className={cn("text-primary", isMinimized ? "w-5 h-5" : "w-10 h-10")} />
        </div>
        
        <div className={isMinimized ? "flex-1" : "text-center"}>
          <h4 className="font-semibold text-foreground truncate max-w-[120px]">
            {session.group_id.substring(0, 8)}...
          </h4>
          <p className="text-sm text-primary font-mono">{formatDuration(duration)}</p>
        </div>
      </div>

      {/* Controls */}
      <div className={cn("flex items-center gap-3", isMinimized ? "" : "mb-2")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className={cn(
            "rounded-full transition-all",
            isMinimized ? "h-9 w-9" : "h-12 w-12",
            isMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-muted text-muted-foreground"
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEndCall}
          className={cn(
            "rounded-full bg-red-500 text-white hover:bg-red-600 animate-pulse-subtle",
            isMinimized ? "h-9 w-9" : "h-14 w-14"
          )}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>

        {!isMinimized && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(true)}
            className="h-12 w-12 rounded-full bg-muted text-muted-foreground"
          >
            <Minimize2 className="w-5 h-5" />
          </Button>
        )}
        
        {isMinimized && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(false)}
            className="h-9 w-9 rounded-full bg-muted text-muted-foreground"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default VoiceCall;
