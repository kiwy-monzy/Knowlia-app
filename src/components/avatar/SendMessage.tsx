import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Focus, SendHorizontal, Square } from 'lucide-react';

interface SendMessageProps {
  customPrompt: string;
  withScreenshotsContext: boolean;
  isProcessing: boolean;
  onSend: () => void;
  onStop: () => void;
  onPromptChange: (value: string) => void;
  onScreenshotsToggle: (value: boolean) => void;
}

function SendMessage({
  customPrompt,
  withScreenshotsContext,
  isProcessing,
  onSend,
  onStop,
  onPromptChange,
  onScreenshotsToggle
}: SendMessageProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && customPrompt.trim()) {
      e.preventDefault();
      onSend();
    }
    if (e.key === 'Enter' && customPrompt === '\n') {
      onPromptChange('');
      e.preventDefault();
    }
  };

  return (
    <div className="absolute bottom-12 right-[110px] min-w-[360px] max-w-[500px]">
      <form className="flex flex-rows w-full items-center gap-1.5">
        <Textarea
          disabled={isProcessing}
          id="prompt"
          placeholder="Say something..."
          value={customPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="bg-white resize-none"
          onKeyDown={handleKeyDown}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isProcessing}
                onClick={() => onScreenshotsToggle(!withScreenshotsContext)}
                className="absolute right-11 bottom-0 z-1 size-6"
              >
                <Focus
                  className={`h-4 w-4 ${withScreenshotsContext ? "text-red-600/80 animate-pulse" : "text-gray-600"}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {withScreenshotsContext
                  ? "Include user's activity in the message"
                  : "No activity context is included"
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isProcessing ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onStop}
            className="h-16 w-8 z-1"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            onClick={onSend}
            disabled={isProcessing || !customPrompt.trim()}
            className="border border-gray-500/50 hover:bg-gray-500/50 h-16 w-8 z-1"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
};

export default SendMessage;
