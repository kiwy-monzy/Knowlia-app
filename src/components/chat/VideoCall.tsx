import React, { useEffect, useRef, useState } from 'react';
import { rtcService, RtcSession } from '@/utils/rtc';
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoCallProps {
  session: RtcSession;
  onClose: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ session, onClose }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.state === 3) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [session.state]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: session.session_type === 2 || session.session_type === 3,
        audio: true
      });
      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }
      
      // Start capturing and sending frames if it's a video call
      if (session.session_type === 2 || session.session_type === 3) {
        startStreaming(mediaStream);
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera or microphone');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startStreaming = (mediaStream: MediaStream) => {
    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320; // Lower resolution for better performance
    canvas.height = 240;

    const sendFrame = async () => {
      if (!stream || !stream.active || isVideoOff) return;
      
      if (ctx && localVideoRef.current) {
        ctx.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Convert to Blob or ArrayBuffer
        canvas.toBlob(async (blob) => {
          if (blob) {
            const buffer = await blob.arrayBuffer();
            try {
              await rtcService.sendVideo(session.group_id, buffer);
            } catch (err) {
              console.error('Failed to send video frame:', err);
            }
          }
        }, 'image/jpeg', 0.5); // Use JPEG with 0.5 quality
      }
      
      // Schedule next frame (approx 10 FPS)
      if (stream && stream.active) {
        setTimeout(sendFrame, 100);
      }
    };

    sendFrame();
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
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
          ? "bottom-4 right-4 w-64 h-48 rounded-2xl" 
          : "inset-4 md:inset-auto md:bottom-24 md:right-8 md:w-[480px] md:h-[360px] rounded-3xl"
      )}
    >
      {/* Remote Video (Currently we just show a placeholder or remote feedback if available) */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <VideoIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground">Active Call</p>
          <p className="text-sm text-muted-foreground">Encryption established</p>
        </div>
      </div>

      {/* Local Video Preview */}
      <div className={cn(
        "absolute transition-all duration-300 bg-black border-2 border-background/20 overflow-hidden",
        isMinimized
          ? "bottom-12 right-2 w-20 h-15 rounded-lg"
          : "bottom-20 right-4 w-32 h-24 rounded-2xl shadow-lg"
      )}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover transform scale-x-[-1]",
            isVideoOff && "hidden"
          )}
        />
        {isVideoOff && (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <VideoOff className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={cn(
              "h-10 w-10 rounded-full",
              isMuted ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVideo}
            className={cn(
              "h-10 w-10 rounded-full",
              isVideoOff ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/20 text-white hover:bg-white/30"
            )}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleEndCall}
            className="h-12 w-12 rounded-full bg-red-500 text-white hover:bg-red-600 animate-pulse-subtle"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-white">Secure Call</span>
        </div>
        <button 
          onClick={() => setIsMinimized(true)}
          className="text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="absolute inset-0 bg-background/90 flex items-center justify-center p-6 text-center">
          <div>
            <p className="text-red-500 font-medium mb-4">{error}</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
