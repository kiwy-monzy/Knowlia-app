import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Message, useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import { Reply, Play, Pause, Volume2, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';

interface ChatMessageProps {
  message: Message;
  previousMessage?: Message;
}

const ChatMessage = ({ message, previousMessage }: ChatMessageProps) => {
  const { contacts, deleteMessages, selectedMessages, toggleMessageSelection, isSelectionMode } = useChatContext();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  // Get current online status from contacts
  const senderContact = contacts.find(contact => contact.id === message.senderId);
  const isOnline = senderContact?.isOnline || false;

  // Handle double click to copy message
  const handleDoubleClick = () => {
    // Copy message content to clipboard
    navigator.clipboard.writeText(message.content).then(() => {
      // Show dashed border effect
      setIsCopied(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy message:', err);
    });
  };

  // Handle click counting for triple-click detection
  const handleClick = () => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    if (timeDiff < 500) { // Within 500ms
      const newClickCount = clickCount + 1;
      setClickCount(newClickCount);

      if (newClickCount === 3) {
        // Triple click detected
        setShowDeleteModal(true);
        setClickCount(0); // Reset click count
      }
    } else {
      // Reset if too much time has passed
      setClickCount(1);
    }

    setLastClickTime(currentTime);
  };

  // Handle delete message
  const handleDeleteMessage = async () => {
    try {
      await deleteMessages([message.id]);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  // Handle mouse down for hold detection
  const handleMouseDown = () => {
    console.log('Mouse down detected, isSelectionMode:', isSelectionMode);
    
    if (isSelectionMode) {
      toggleMessageSelection(message.id);
      return;
    }

    const timer = setTimeout(() => {
      console.log('Hold detected, selecting message:', message.id);
      setIsHolding(true);
      toggleMessageSelection(message.id);
    }, 500); // 500ms hold time
    setHoldTimer(timer);
  };

  // Handle mouse up to cancel hold
  const handleMouseUp = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    setIsHolding(false);
  };

  // Handle mouse leave to cancel hold
  const handleMouseLeave = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    setIsHolding(false);
  };

  // Function to convert local file path to data URL
  const convertFileToDataUrl = async (filePath: string): Promise<string | null> => {
    try {
      // Use Tauri invoke to read the file as base64
      const base64Data = await invoke<string>('read_file_as_base64', { filePath });
      
      // Determine MIME type from file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      let mimeType = 'application/octet-stream';
      if (extension) {
        const mimeTypes: { [key: string]: string } = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'm4a': 'audio/mp4',
          'aac': 'audio/aac',
          'flac': 'audio/flac',
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mov': 'video/quicktime',
          'avi': 'video/x-msvideo',
          'mkv': 'video/x-matroska'
        };
        mimeType = mimeTypes[extension] || 'application/octet-stream';
      }
      
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      console.error('Failed to convert file to data URL:', error);
      return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const showAvatar = !previousMessage || 
                    previousMessage.senderId !== message.senderId || 
                    previousMessage.message_type === 'system';
  const showName = showAvatar && !message.isOwn;

  const StatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <span className="text-[10px] text-gray-400 font-mono tracking-tighter">..</span>;
      case 'sent':
        return <Check className="h-4 w-4 text-gray-400" />;
      case 'confirmed':
        return <CheckCheck className="h-4 w-4 text-gray-400" />;
      case 'confirmed_by_all':
        return <CheckCheck className="h-4 w-4 text-blue-400" />;
      case 'receiving':
        return <span className="text-[10px] text-gray-400 font-mono tracking-tighter">🚚</span>;
      case 'received':
        return <span className="text-[10px] text-gray-400 font-mono tracking-tighter">📨</span>;
      default:
        return null;
    }
  };

  // System messages (group events) styling
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">
          {message.senderName} {message.content}
        </div>
      </div>
    );
  }

  // File messages styling - use fileInfo for proper file handling
  if (message.message_type === 'file') {
    // Load media data when component mounts or fileInfo changes
    React.useEffect(() => {
      const loadMedia = async () => {
        // Check both fileInfo and try to extract from content as fallback
        let filePath = message.fileInfo?.filePath;
        let extension = message.fileInfo?.fileExtension;

        
        if (filePath && extension) {
          const ext = extension.toLowerCase();
          
          // Load images
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            const dataUrl = await convertFileToDataUrl(filePath);
            setImageDataUrl(dataUrl);
          }
          // Load audio
          else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
            const dataUrl = await convertFileToDataUrl(filePath);
            setAudioDataUrl(dataUrl);
          }
          // Load video
          else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
            const dataUrl = await convertFileToDataUrl(filePath);
            setVideoDataUrl(dataUrl);
          }
        } 
      };
      loadMedia();
    }, [message.fileInfo?.filePath, message.fileInfo?.fileExtension, message.content]);

    const isImage = message.fileInfo?.fileExtension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(message.fileInfo.fileExtension.toLowerCase()) && imageDataUrl;
    const isAudio = message.fileInfo?.fileExtension && ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(message.fileInfo.fileExtension.toLowerCase()) && audioDataUrl;
    const isVideo = message.fileInfo?.fileExtension && ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(message.fileInfo.fileExtension.toLowerCase()) && videoDataUrl;

    return (
      <div
        className={cn(
          'flex gap-2 px-4 py-1',
          message.isOwn ? 'flex-row-reverse' : ''
        )}
      >
        {/* Avatar */}
        <div className={cn('w-8 flex-shrink-0 relative', !showAvatar && 'invisible')}>
          <Avatar className="h-8 w-8">
            {message.senderAvatar ? (
              <img 
                src={message.senderAvatar} 
                alt={message.senderName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback className="bg-[#e9edef] text-[#111b21] text-sm font-medium">
                {getInitials(message.senderName)}
              </AvatarFallback>
            )}
          </Avatar>
          {/* Online Status Indicator */}
          {showName && isOnline && (
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></div>
          )}
        </div>

        {/* Message Content */}
        <div className={cn('flex flex-col max-w-[75%]', message.isOwn && 'items-end')}>
          {/* Sender Name */}
          {showName && (
            <span className="text-xs font-medium text-[#667781] mb-1 px-1 flex items-center gap-1">
              {message.senderName}
              {message.senderCollege && (
                <>
                  <span className="text-[10px] opacity-50">·</span>
                  <span className="text-[10px] font-normal opacity-70 truncate max-w-[120px]">
                    {message.senderCollege}
                  </span>
                </>
              )}
            </span>
          )}

          {/* File Message Bubble */}
          <div
            className={cn(
              'relative  shadow-sm',
              isImage ? 'p-1 max-w-[320px]' : 'px-3 py-2 max-w-[300px]',
              message.isOwn
                ? 'bg-[#dcf8c6] rounded-tl-2xl rounded-tr-2xl rounded-br-md'
                : 'bg-[#ffffff] rounded-tl-2xl rounded-tr-2xl rounded-bl-md border border-[#e9edef]'
            )}
          >
            {isImage && imageDataUrl ? (
              // Image preview
              <div className="relative">
                <img 
                  src={imageDataUrl} 
                  alt="Shared image"
                  className="max-w-full max-h-[400px] w-auto cursor-pointer hover:opacity-95 rounded-lg"
                  onClick={async () => {
                    try {
                      if (message.fileInfo?.filePath) {
                        await invoke('open_file', { filePath: message.fileInfo.filePath });
                      } else {
                        window.open(imageDataUrl, '_blank');
                      }
                    } catch (error) {
                      console.error('Failed to open file:', error);
                      window.open(imageDataUrl, '_blank');
                    }
                  }}
                />
                {/* File description below image */}
                {message.fileInfo?.fileDescription && (
                  <div className="mt-2 px-2 pb-1">
                    <p className="text-xs text-[#667781] text-left leading-relaxed">
                      {message.fileInfo.fileDescription}
                    </p>
                  </div>
                )}
                {/* Time & Status below description */}
                <div className={cn(
                  'flex items-center gap-1 px-2 pb-2',
                  message.isOwn ? 'justify-end' : 'justify-start'
                )}>
                  <span className="text-[11px] text-[#667781]">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.isOwn && <StatusIcon />}
                </div>
              </div>
            ) : isAudio && audioDataUrl ? (
              // Audio player
              <div className="w-full max-w-[300px]">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Volume2 className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {message.fileInfo?.fileName || 'Audio'}
                    </p>
                    <p className="text-xs text-[#667781]">
                      {message.fileInfo ? formatFileSize(message.fileInfo.fileSize) : 'Audio file'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => {
                      if (audioDataUrl) {
                        setIsPlaying(!isPlaying);
                      }
                    }}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
                <audio 
                  ref={(el) => {
                    if (el) {
                      if (isPlaying) {
                        el.play().catch(console.error);
                      } else {
                        el.pause();
                      }
                    }
                  }}
                  src={audioDataUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                {/* File description below audio */}
                {message.fileInfo?.fileDescription && (
                  <div className="mt-2 px-2 pb-1">
                    <p className="text-xs text-[#667781] text-left leading-relaxed">
                      {message.fileInfo.fileDescription}
                    </p>
                  </div>
                )}
                {/* Time & Status below description */}
                <div className={cn(
                  'flex items-center gap-1 px-2 pb-2',
                  message.isOwn ? 'justify-end' : 'justify-start'
                )}>
                  <span className="text-[11px] text-[#667781]">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.isOwn && <StatusIcon />}
                </div>
              </div>
            ) : isVideo && videoDataUrl ? (
              // Video player
              <div className="w-full max-w-[320px]">
                <div className="relative">
                  <video 
                    src={videoDataUrl}
                    className="w-full max-h-[300px] rounded-lg cursor-pointer"
                    controls
                    onClick={async () => {
                      try {
                        if (message.fileInfo?.filePath) {
                          await invoke('open_file', { filePath: message.fileInfo.filePath });
                        }
                      } catch (error) {
                        console.error('Failed to open file:', error);
                      }
                    }}
                  />
                  {/* File description below video */}
                  {message.fileInfo?.fileDescription && (
                    <div className="mt-2 px-2 pb-1">
                      <p className="text-xs text-[#667781] text-left leading-relaxed">
                        {message.fileInfo.fileDescription}
                      </p>
                    </div>
                  )}
                  {/* Time & Status below description */}
                  <div className={cn(
                    'flex items-center gap-1 px-2 pb-2',
                    message.isOwn ? 'justify-end' : 'justify-start'
                  )}>
                    <span className="text-[11px] text-[#667781]">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.isOwn && <StatusIcon />}
                  </div>
                </div>
              </div>
            ) : (
              // Generic file display
              <div className="w-full">
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                  onClick={async () => {
                    try {
                      if (message.fileInfo?.filePath) {
                        await invoke('open_file', { filePath: message.fileInfo.filePath });
                      } else {
                        console.error('No file path available for opening');
                      }
                    } catch (error) {
                      console.error('Failed to open file:', error);
                      const filePath = message.fileInfo?.filePath || message.content || '';
                      if (filePath.trim() && (filePath.includes('\\') || filePath.includes('/'))) {
                        try {
                          const dataUrl = await convertFileToDataUrl(filePath);
                          if (dataUrl) {
                            const newWindow = window.open(dataUrl, '_blank');
                            if (newWindow) {
                              newWindow.focus();
                            }
                          }
                        } catch (fallbackError) {
                          console.error('Fallback also failed:', fallbackError);
                        }
                      }
                    }
                  }}
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-medium">FILE</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {message.fileInfo?.fileName || message.content?.split('\\').pop()?.split('/').pop() || 'File'}
                    </p>
                    <p className="text-xs text-[#667781]">
                      {message.fileInfo ? formatFileSize(message.fileInfo.fileSize) : 'Click to open'}
                    </p>
                  </div>
                </div>
                {/* File description below document */}
                {message.fileInfo?.fileDescription && (
                  <div className="mt-2 px-2 pb-1">
                    <p className="text-xs text-[#667781] text-left leading-relaxed">
                      {message.fileInfo.fileDescription}
                    </p>
                  </div>
                )}
                {/* Time & Status below description */}
                <div className={cn(
                  'flex items-center gap-1 px-2 pb-2',
                  message.isOwn ? 'justify-end' : 'justify-start'
                )}>
                  <span className="text-[11px] text-[#667781]">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.isOwn && <StatusIcon />}
                </div>
              </div>
            )}

            {/* Time & Status for text messages only */}
            {message.message_type !== 'file' && (
              <div className={cn(
                'flex items-center gap-1 mt-2',
                message.isOwn ? 'justify-end' : 'justify-start'
              )}>
                <span className="text-[11px] text-[#667781]">
                  {formatTime(message.timestamp)}
                </span>
                {message.isOwn && <StatusIcon />}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular text messages
  return (
    <div
      className={cn(
        'flex gap-2 px-4 py-1',
        message.isOwn ? 'flex-row-reverse' : ''
      )}
    >
      {/* Avatar */}
      <div className={cn('w-8 flex-shrink-0 relative', !showAvatar && 'invisible')}>
        <Avatar className="h-8 w-8">
          {message.senderAvatar ? (
            <img 
              src={message.senderAvatar} 
              alt={message.senderName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <AvatarFallback className="bg-[#e9edef] text-[#111b21] text-sm font-medium">
              {getInitials(message.senderName)}
            </AvatarFallback>
          )}
        </Avatar>
        {/* Online Status Indicator */}
        {showName && isOnline && (
          <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></div>
        )}
      </div>

      {/* Message Content */}
      <div className={cn('flex flex-col max-w-[75%]', message.isOwn && 'items-end')}>
        {/* Sender Name */}
        {showName && (
          <span className="text-xs font-medium text-[#667781] mb-1 px-1 flex items-center gap-1">
            {message.senderName}
            {message.senderCollege && (
              <>
                <span className="text-[10px] opacity-50">·</span>
                <span className="text-[10px] font-normal opacity-70 truncate max-w-[120px]">
                  {message.senderCollege}
                </span>
              </>
            )}
          </span>
        )}

        {/* Reply Preview */}
        {message.replyTo && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg border-l-2 border-primary/50',
            message.isOwn ? 'bg-chat-message-own/50' : 'bg-muted/50'
          )}>
            <Reply className="h-3 w-3 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">{message.replyTo.author}</p>
              <p className="text-xs text-muted-foreground truncate">{message.replyTo.content}</p>
            </div>
          </div>
        )}

        {/* Message Bubble */}
        <div
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className={cn(
            'relative px-3 py-2 shadow-sm cursor-pointer select-none',
            message.isOwn
              ? 'bg-[#dcf8c6] text-[#111b21] rounded-tl-2xl rounded-tr-2xl rounded-br-2xl'
              : 'bg-[#ffffff] text-[#111b21] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl border border-[#e9edef]',
            isCopied ? 'border-2 border-dashed border-blue-500' : '',
            isHolding ? 'scale-95 opacity-80' : '',
            selectedMessages.has(message.id) ? 'ring-2 ring-blue-500 ring-offset-2' : '',
            isSelectionMode ? 'hover:ring-1 hover:ring-blue-300' : ''
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {/* Time & Status */}
          <div className={cn(
            'flex items-center gap-1 mt-0.5',
            message.isOwn ? 'justify-end' : 'justify-start'
          )}>
            <span className="text-[11px] text-[#667781]">
              {formatTime(message.timestamp)}
            </span>
            {message.isOwn && <StatusIcon />}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1 px-1">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80  text-xs"
              >
                <span>{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Message?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg "
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg "
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

export default ChatMessage;