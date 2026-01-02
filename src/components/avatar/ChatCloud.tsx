import React from 'react';
import { Terminal, Wrench, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { MessagePart } from '@/utils/messageParser';
import MarkdownBlock from './MarkdownBlock';
import Thinking from './Thinking';
import './Avatar.css';

interface ChatCloudProps {
  parts: MessagePart[];
  error: string;
  isProcessing: boolean;
  visible: boolean;
  onContentChanged?: () => void;
  currentTool: string | null;
  isThinking?: boolean;
}

const ChatCloud: React.FC<ChatCloudProps> = ({
  parts = [],
  error = "",
  visible = false,
  onContentChanged = () => {},
  currentTool = "",
  isProcessing = false,
  isThinking = false,
}) => {
  if (!visible && !error) return null;

  return (
    <div
      className={`chat-cloud absolute bg-card/95 backdrop-blur-xl rounded-2xl border border-border shadow-xl p-4 overflow-y-auto w-[400px] max-h-[500px] z-10 text-sm leading-relaxed transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      } chat-cloud-position`}
    >
      {error ? (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {parts.map((part, index) => (
            <div key={`${part.type}-${index}`}>
              {part.type === "markdown" && <MarkdownBlock content={part.content} />}
              {part.type === "text" && (
                <p className="text-foreground whitespace-pre-wrap">{part.content}</p>
              )}
              {part.type === "code" && (
                <pre className="bg-muted rounded-lg p-3 overflow-x-auto text-xs">
                  <code className="text-foreground">{part.content}</code>
                </pre>
              )}
              {part.type === "thinking" && (
                <Thinking
                  content={part.content}
                  isThinking={isThinking}
                  onToggled={onContentChanged}
                />
              )}
              {part.type === "tool_call" && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-sm text-primary font-medium">{part.content}</span>
                </div>
              )}
            </div>
          ))}

          {currentTool && (
            <div className="flex items-center gap-2 p-3 bg-accent/50 border border-accent rounded-lg animate-pulse">
              <Wrench className="h-4 w-4 text-accent-foreground" />
              <span className="text-sm text-accent-foreground font-medium">
                Using: {currentTool}
              </span>
            </div>
          )}

          {isProcessing && parts.length === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatCloud;
