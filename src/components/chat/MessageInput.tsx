import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X, Mic, Image, FileText, Sparkles } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import EmojiPicker from './EmojiPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageInputProps {
  replyTo?: { id: string; author: string; content?: string };
  onReplyCancel?: () => void;
}

const MessageInput = ({ replyTo, onReplyCancel }: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, sendFile, currentChannel } = useChatContext();

  const handleSend = async () => {
    if (!currentChannel) return;
    
    try {
      if (selectedFile) {
        // Send file with message as description
        await sendFile(selectedFile, message.trim());
        setSelectedFile(null);
        setMessage('');
      } else if (message.trim()) {
        // Send text message
        await sendMessage(message.trim());
        setMessage('');
      }
      
      onReplyCancel?.();

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
  };

  if (!currentChannel) return null;

  return (
    <div className="w-full">
      {/* Attachments Container - Horizontal Layout */}
      <div className="flex gap-2 ">
        {/* Reply Preview */}
        {replyTo && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-border flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary mb-0.5">
                  Replying to {replyTo.author}
                </p>
                {replyTo.content && (
                  <p className="text-sm text-muted-foreground truncate">
                    {replyTo.content}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={onReplyCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* File Preview - Compact inline attachment */}
        {selectedFile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border">
            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 rounded hover:bg-destructive/10 hover:text-destructive"
              onClick={clearSelectedFile}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Input Container */}
      <div 
        className={cn(
          'relative   duration-300 w-full overflow-hidden',
          'bg-white shadow-2xl border-t border-r border-b  '
        )}
      >
        {/* Content Container */}
        <div className={cn(
          'relative z-10   duration-300 w-full',
          'bg-gradient-to-br from-white/70 to-white/60',
          isFocused 
            ? 'shadow-lg shadow-black/10' 
            : ''
        )}>
        {/* Top Row - Textarea */}
        <div className="px-4 pt-4 pb-2 w-full">
          <textarea
            ref={textareaRef}
            placeholder={selectedFile ? `Add a description for ${selectedFile.name}...` : `Message ${currentChannel.name}...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={1}
            className={cn(
              'w-full bg-transparent border-0 outline-none resize-none',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'min-h-[28px] max-h-[150px]'
            )}
          />
        </div>

        {/* Bottom Row - Actions */}
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            {/* Attachment Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem className="gap-3" onClick={() => document.getElementById('image-file-input')?.click()}>
                  <Image className="h-4 w-4 text-primary" />
                  Photos & Videos
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3" onClick={() => document.getElementById('document-file-input')?.click()}>
                  <FileText className="h-4 w-4 text-blue-500" />
                  Documents
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Hidden file inputs */}
            <input
              id="image-file-input"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload image or video"
              title="Upload image or video"
            />
            <input
              id="document-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload document"
              title="Upload document"
            />

            {/* Emoji Picker */}
            <EmojiPicker onEmojiSelect={handleEmojiSelect} className="hidden" />

            {/* Voice Message */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 hidden"
            >
              <Mic className="h-[18px] w-[18px] hidden" />
            </Button>

            {/* AI Magic */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 hidden"
            >
              <Sparkles className="h-[18px] w-[18px]" />
            </Button>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !selectedFile)}
            size="icon"
            className={cn(
              'h-12 w-12 rounded-xl  duration-200',
              (message.trim() || selectedFile)
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/25'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;