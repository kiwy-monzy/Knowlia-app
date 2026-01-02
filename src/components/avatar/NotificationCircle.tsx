import { useState, useEffect } from 'react';
import { Bell, ThumbsUp, ThumbsDown } from 'lucide-react';

interface NotificationCircleProps {
  notification: {
    id: string;
    fromTest: boolean;
  } | null;
  handleNotification: (action: string) => void;
}

export default function NotificationCircle({ notification = null, handleNotification }: NotificationCircleProps) {
  const [timeLeft, setTimeLeft] = useState(20);
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldPulse, setShouldPulse] = useState(false);

  const TIME_LIMIT = 20;

  const triggerPulse = () => {
    setShouldPulse(!shouldPulse);
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let countdownId: NodeJS.Timeout | null = null;

    if (notification) {
      // Reset state for new notification
      setTimeLeft(TIME_LIMIT);
      setIsExpanded(false);

      // Start countdown
      countdownId = setInterval(() => {
        setTimeLeft((prev) => {
          const newTimeLeft = prev - 1;
          triggerPulse();
          if (newTimeLeft <= 0) {
            handleOmit();
          }
          return newTimeLeft;
        });
      }, 1000);

      // Auto-omit after TIME_LIMIT seconds
      timeoutId = setTimeout(() => {
        handleOmit();
      }, TIME_LIMIT * 1000);
    } else {
      // Clear timers when notification is null
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (countdownId) {
        clearInterval(countdownId);
        countdownId = null;
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (countdownId) {
        clearInterval(countdownId);
      }
    };
  }, [notification]);

  const handleAccept = () => {
    handleNotification("accept");
    cleanup();
  };

  const handleReject = () => {
    handleNotification("reject");
    cleanup();
  };

  const handleOmit = () => {
    handleNotification("omit");
    cleanup();
  };

  const cleanup = () => {
    setTimeLeft(TIME_LIMIT);
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!notification) return null;

  return (
    <div
      className="flex items-center justify-center absolute top-2 right-2 z-100 w-28 h-32"
      role="button"
      tabIndex={0}
      onMouseLeave={() => setIsExpanded(false)}
      onMouseEnter={toggleExpanded}
      data-tauri-drag-region
    >
      {/* Pulsing notification indicator */}
      <div className="ml-8 w-10 h-10 bg-yellow-500 rounded-full cursor-pointer shadow-lg">
        <button className="w-10 h-10 bg-white/90 rounded-sm border-2 border-yellow-500 flex items-center justify-center text-center">
          <span className="ml-1 text-4xl font-tiny5 font-bold text-yellow-500">
            {timeLeft}
          </span>
        </button>
      </div>

      {/* Expanded notification panel */}
      {isExpanded && (
        <div className="absolute top-20 rounded-lg">
          {/* Action buttons */}
          <div className="ml-8 flex gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-1 p-1 bg-green-500 rounded-md hover:bg-green-600 transition-colors text-white cursor-pointer"
              onClick={handleAccept}
            >
              <ThumbsUp className="size-7" />
            </button>

            <button
              className="flex-1 flex items-center justify-center gap-1 px-1 bg-red-500 rounded-md hover:bg-red-600 transition-colors text-white cursor-pointer"
              onClick={handleReject}
            >
              <ThumbsDown className="size-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
