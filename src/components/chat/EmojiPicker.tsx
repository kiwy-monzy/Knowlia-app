import { useState, useRef, useEffect } from 'react';
import EmojiPickerReact, { Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

const EmojiPicker = ({ onEmojiSelect, className }: EmojiPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)} ref={pickerRef}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Smile className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute -bottom-64 left-1/2 transform -translate-x-1/2 z-50 animate-scale-in">
          <EmojiPickerReact
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji);
              setIsOpen(false);
            }}
            theme={Theme.DARK}
            width={320}
            height={400}
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
