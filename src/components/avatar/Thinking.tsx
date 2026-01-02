import { useState, useEffect, useRef } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb } from 'lucide-react';
import MarkdownBlock from './MarkdownBlock';

interface ThinkingProps {
  content: string;
  isThinking: boolean;
  onToggled: () => void;
}

export default function Thinking({ content = "", isThinking = false, onToggled = () => {} }: ThinkingProps) {
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isOpenByUser, setIsOpenByUser] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const accordionValue = isThinking || isOpenByUser ? "item-1" : undefined;

  useEffect(() => {
    // When content changes, check if we need to scroll
    if (contentContainerRef.current && isThinking && !isUserScrolling) {
      // Use setTimeout to wait for the DOM to update before scrolling
      setTimeout(() => {
        if (contentContainerRef.current) {
          contentContainerRef.current.scrollTop = contentContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [content, isThinking, isUserScrolling]);

  const handleScroll = () => {
    if (!contentContainerRef.current) return;
    setIsUserScrolling(true);
    clearTimeout(scrollTimeoutRef.current!);

    const isAtBottom =
      contentContainerRef.current.scrollTop + contentContainerRef.current.clientHeight >=
      contentContainerRef.current.scrollHeight - 10;

    if (isAtBottom) {
      setIsUserScrolling(false);
    } else {
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 2000);
    }
  };

  const handleToggle = () => {
    if (!isThinking) {
      setIsOpenByUser(!isOpenByUser);
      setTimeout(() => {
        onToggled();
      }, 200);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .thinking-indicator {
          display: inline-flex;
          align-items: center;
        }

        .thinking [data-state="open"],
        .thinking [data-state="closed"] {
          animation: none !important;
          transition: none !important;
        }

        .thinking-content {
          max-height: 300px;
          overflow-y: auto;
          scroll-behavior: auto;
        }
        `
      }} />
      <div
        className={`my-4 border border-gray-300 rounded-lg px-2 ${isThinking ? 'thinking' : ''}`}
      >
        <Accordion className="w-full" type="single" value={accordionValue}>
          <AccordionItem value="item-1" className="p-0">
            <AccordionTrigger
              className="text-sm font-medium"
              onClick={handleToggle}
              disabled={isThinking}
            >
              <div className="flex items-center">
                <Lightbulb />
                {isThinking ? (
                  <span className="thinking-indicator"> Thinking... </span>
                ) : (
                  "Thinking"
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div
                className="thinking-content text-xs"
                ref={contentContainerRef}
                onScroll={handleScroll}
              >
                <MarkdownBlock content={content} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
