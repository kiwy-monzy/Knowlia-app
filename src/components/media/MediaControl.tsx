import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { mediaControls, PlaybackStatus, RepeatMode } from 'tauri-plugin-media-api';

// Types from the documentation
interface MediaMetadata {
  title: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  duration?: number;
  artworkUrl?: string;
  artworkData?: string;
}

// PlaybackInfo type for documentation reference
// Note: Actual API uses individual getter/setter methods

interface MediaControlProps {
  className?: string;
}

export const MediaControl: React.FC<MediaControlProps> = ({ className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMedia, setCurrentMedia] = useState<MediaMetadata | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isMediaAvailable, setIsMediaAvailable] = useState(false);
  const [position, setPosition] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.None);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const initializeMediaControls = async () => {
      // Prevent repeated initialization if it already failed
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      try {
        // Check if media controls are available
        const enabled = await mediaControls.isEnabled();
        setIsMediaAvailable(enabled);
        
        if (enabled) {
          // Initialize media session
          await mediaControls.initialize('qaul-app', 'Qaul Media Player');
          
          // Get current metadata if available
          const metadata = await mediaControls.getMetadata();
          if (metadata) {
            setCurrentMedia(metadata);
          }
          
          // Get current playback info
          const playbackInfo = await mediaControls.getPlaybackInfo();
          if (playbackInfo) {
            setIsPlaying(playbackInfo.status === PlaybackStatus.Playing);
            setPosition(playbackInfo.position);
            setShuffle(playbackInfo.shuffle);
            setRepeatMode(playbackInfo.repeatMode);
          }
        }
      } catch (error) {
        // Only log the error once to avoid repeated console spam
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to initialize media controls:', errorMessage);
        setIsMediaAvailable(false);
      }
    };

    initializeMediaControls();

    // Set up position tracking interval
    const startPositionTracking = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(async () => {
        if (isMediaAvailable && isPlaying) {
          try {
            const currentPosition = await mediaControls.getPosition();
            setPosition(currentPosition);
          } catch (error) {
            console.error('Failed to get position:', error);
          }
        }
      }, 1000);
    };

    startPositionTracking();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMediaAvailable, isPlaying]);

  const handlePlayPause = async () => {
    if (!isMediaAvailable) return;
    
    try {
      await mediaControls.togglePlayPause();
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Failed to toggle play/pause:', error);
    }
  };

  const handleNext = async () => {
    if (!isMediaAvailable) return;
    
    try {
      await mediaControls.next();
    } catch (error) {
      console.error('Failed to skip to next track:', error);
    }
  };

  const handlePrevious = async () => {
    if (!isMediaAvailable) return;
    
    try {
      await mediaControls.previous();
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
    }
  };

  const handleShuffleToggle = async () => {
    if (!isMediaAvailable) return;
    
    try {
      const newShuffle = !shuffle;
      // Use individual setters instead of setPlaybackInfo
      await mediaControls.updatePlaybackStatus(isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused);
      await mediaControls.updatePosition(position);
      // Note: shuffle and repeat mode would need to be set via updateNowPlaying
      // For now, we'll update local state
      setShuffle(newShuffle);
    } catch (error) {
      console.error('Failed to toggle shuffle:', error);
    }
  };

  const handleRepeatModeToggle = async () => {
    if (!isMediaAvailable) return;
    
    try {
      const modes = [RepeatMode.None, RepeatMode.Track, RepeatMode.List];
      const currentIndex = modes.indexOf(repeatMode);
      const newRepeatMode = modes[(currentIndex + 1) % modes.length];
      
      // Use individual setters instead of setPlaybackInfo
      await mediaControls.updatePlaybackStatus(isPlaying ? PlaybackStatus.Playing : PlaybackStatus.Paused);
      await mediaControls.updatePosition(position);
      // Note: shuffle and repeat mode would need to be set via updateNowPlaying
      // For now, we'll update local state
      setRepeatMode(newRepeatMode);
    } catch (error) {
      console.error('Failed to toggle repeat mode:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case RepeatMode.Track:
        return <Repeat1 size={14} />;
      case RepeatMode.List:
        return <Repeat size={14} />;
      default:
        return <Repeat size={14} />;
    }
  };

  if (!currentMedia) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1 rounded-md border border-black/20 sidebar-3d-icon transition-all duration-200 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Music size={16} className="text-gray-500" />
        <span className="text-sm text-gray-500">No media playing</span>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-3 px-3 py-1 rounded-md border border-black/20 sidebar-3d-icon transition-all duration-200 hover:bg-black/10 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
        {currentMedia.artworkData ? (
          <img 
            src={currentMedia.artworkData} 
            alt="Album art" 
            className="w-full h-full object-cover"
          />
        ) : currentMedia.artworkUrl ? (
          <img 
            src={currentMedia.artworkUrl} 
            alt="Album art" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Media info and progress */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {currentMedia.title}
        </div>
        <div className="text-xs opacity-70 truncate">
          {currentMedia.artist}
        </div>
        
        {/* Progress bar - always visible but more prominent on hover */}
        {currentMedia.duration && (
          <div className={`mt-1 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">
                {formatTime(position)}
              </span>
              <div className="flex-1 h-1 bg-black/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(position / currentMedia.duration) * 100}%` }}
                />
              </div>
              <span className="text-xs opacity-70">
                {formatTime(currentMedia.duration)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Extended controls on hover */}
      <div className={`flex items-center gap-1 transition-all duration-200 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
        <button
          onClick={handleShuffleToggle}
          className={`p-1 rounded transition-colors ${shuffle ? 'bg-blue-500 text-white' : 'hover:bg-black/20'}`}
          title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
        >
          <Shuffle size={14} />
        </button>
        
        <button
          onClick={handleRepeatModeToggle}
          className={`p-1 rounded transition-colors ${repeatMode !== RepeatMode.None ? 'bg-blue-500 text-white' : 'hover:bg-black/20'}`}
          title={`Repeat: ${repeatMode}`}
        >
          {getRepeatIcon()}
        </button>
        
        <button
          onClick={handlePrevious}
          className="p-1 rounded hover:bg-black/20 transition-colors"
          title="Previous"
        >
          <SkipBack size={14} />
        </button>
        
        <button
          onClick={handlePlayPause}
          className="p-1 rounded hover:bg-black/20 transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        
        <button
          onClick={handleNext}
          className="p-1 rounded hover:bg-black/20 transition-colors"
          title="Next"
        >
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
};
