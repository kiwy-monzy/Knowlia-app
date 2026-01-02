import React, { useEffect, useState, useRef, useCallback } from 'react';

// Define interfaces
interface DefaultAvatarProps {
  isStreaming: boolean;
  isCallingModel: boolean;
  isFocused: boolean;
  isThinking: boolean;
}

type AvatarState = 
  | 'IDLE' 
  | 'FOCUSED' 
  | 'THINKING' 
  | 'LOADING' 
  | 'TALKING' 
  | 'NOTIFIED' 
  | 'HAPPY' 
  | 'ALMOST_SLEEPY' 
  | 'SLEEPY';

// Image assets configuration
const ImageAssets = {
  BASE: '/loyca/base.png',
  MOUTH_OPEN: '/loyca/open_beak.png',
  EYES: {
    NORMAL: '/loyca/normal_eyes.png',
    HALF: '/loyca/half-open_eyes.png',
    CLOSED: '/loyca/closed_eyes.png',
    TIRED: '/loyca/tired_eyes.png',
    WIDE: '/loyca/wide-open_eyes.png',
    HAPPY: '/loyca/happy_eyes.png',
  },
  EFFECTS: {
    EXCLAMATION: '/loyca/exclamation.png',
    INTERROGATION: '/loyca/interrogation.png',
    SPARK: '/loyca/spark.png',
    SLEEPY: '/loyca/sleepy.png',
  },
};

const TIRED_AFTER_MS = 120000;

const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  isStreaming,
  isCallingModel,
  isFocused,
  isThinking,
}) => {
  // State
  const [avatarState, setAvatarState] = useState<AvatarState>('IDLE');
  const [baseEyesURL, setBaseEyesURL] = useState(ImageAssets.EYES.NORMAL);
  const [actualEyesURL, setActualEyesURL] = useState(ImageAssets.EYES.NORMAL);
  const [actualAvatarURL, setActualAvatarURL] = useState(ImageAssets.BASE);
  const [effectURL, setEffectURL] = useState<string | null>(null);
  const [effectClass, setEffectClass] = useState('');
  const [avatarEffectClass, setAvatarEffectClass] = useState('');

  // Refs for managing intervals and timeouts
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const isBlinkingRef = useRef(false);
  const isTalkingRef = useRef(false);
  const isMarkAnimatingRef = useRef(false);

  // Helper function for sleep/delay
  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timersRef.current.push(timer);
    });
  }, []);

  // Effect to determine avatar state based on props
  useEffect(() => {
    let sleepyTimer: NodeJS.Timeout;
    let almostSleepyTimer: NodeJS.Timeout;

    if (isThinking) {
      setAvatarState('THINKING');
    } else if (isStreaming) {
      setAvatarState('TALKING');
    } else if (isCallingModel) {
      setAvatarState('LOADING');
    } else if (isFocused) {
      setAvatarState('FOCUSED');
    } else {
      setAvatarState('IDLE');
      
      // Set timers for sleepy states
      sleepyTimer = setTimeout(() => {
        setAvatarState('SLEEPY');
      }, TIRED_AFTER_MS);
      
      almostSleepyTimer = setTimeout(() => {
        setAvatarState('ALMOST_SLEEPY');
      }, (TIRED_AFTER_MS * 3) / 4);

      timersRef.current.push(sleepyTimer, almostSleepyTimer);
    }

    // Cleanup function
    return () => {
      if (sleepyTimer) clearTimeout(sleepyTimer);
      if (almostSleepyTimer) clearTimeout(almostSleepyTimer);
    };
  }, [isThinking, isStreaming, isCallingModel, isFocused]);

  // Effect to update avatar appearance based on state
  useEffect(() => {
    isTalkingRef.current = false;
    isMarkAnimatingRef.current = false;
    setEffectURL(null);
    setEffectClass('');
    setAvatarEffectClass('');
    setActualAvatarURL(ImageAssets.BASE);

    switch (avatarState) {
      case 'IDLE':
        setBaseEyesURL(ImageAssets.EYES.NORMAL);
        break;
      case 'HAPPY':
        setBaseEyesURL(ImageAssets.EYES.HAPPY);
        setActualAvatarURL(ImageAssets.MOUTH_OPEN);
        setEffectURL(ImageAssets.EFFECTS.SPARK);
        setEffectClass('custom-animate-expand');
        break;
      case 'FOCUSED':
        setBaseEyesURL(ImageAssets.EYES.NORMAL);
        break;
      case 'LOADING':
        setBaseEyesURL(ImageAssets.EYES.HALF);
        setEffectURL(ImageAssets.EFFECTS.EXCLAMATION);
        setEffectClass('custom-animate-expand');
        break;
      case 'THINKING':
        setBaseEyesURL(ImageAssets.EYES.HALF);
        setEffectURL(ImageAssets.EFFECTS.INTERROGATION);
        setEffectClass('custom-animate-expand');
        break;
      case 'TALKING':
        setBaseEyesURL(ImageAssets.EYES.NORMAL);
        isTalkingRef.current = true;
        talk();
        break;
      case 'NOTIFIED':
        setBaseEyesURL(ImageAssets.EYES.WIDE);
        setEffectURL(ImageAssets.EFFECTS.EXCLAMATION);
        setAvatarEffectClass('custom-animate-bounce');
        isMarkAnimatingRef.current = true;
        animateMark();
        break;
      case 'ALMOST_SLEEPY':
        setBaseEyesURL(ImageAssets.EYES.HALF);
        break;
      case 'SLEEPY':
        setBaseEyesURL(ImageAssets.EYES.TIRED);
        setEffectURL(ImageAssets.EFFECTS.SLEEPY);
        setEffectClass('custom-animate-ping');
        break;
    }
  }, [avatarState]);

  // Effect to sync actual eyes URL with base eyes URL
  useEffect(() => {
    setActualEyesURL(baseEyesURL);
  }, [baseEyesURL]);

  // Blink loop function
  const blinkLoop = useCallback(async () => {
    isBlinkingRef.current = true;
    
    while (isBlinkingRef.current) {
      const randomDelay = Math.random() * 5000 + 2000;
      await sleep(randomDelay);

      if (avatarState !== 'SLEEPY') {
        setActualEyesURL(ImageAssets.EYES.HALF);
        await sleep(100);
        setActualEyesURL(ImageAssets.EYES.CLOSED);
        await sleep(100);
        setActualEyesURL(ImageAssets.EYES.HALF);
        await sleep(100);
        setActualEyesURL(baseEyesURL);
      } else {
        setActualEyesURL(ImageAssets.EYES.CLOSED);
        const randomDelay = Math.random() * 1000 + 2000;
        await sleep(randomDelay);
        setActualEyesURL(baseEyesURL);
      }
    }
  }, [avatarState, baseEyesURL, sleep]);

  // Talk animation
  const talk = useCallback(async () => {
    if (!isTalkingRef.current) return;
    
    setActualAvatarURL(ImageAssets.MOUTH_OPEN);
    await sleep(150);
    setActualAvatarURL(ImageAssets.BASE);
    await sleep(Math.random() * 100 + 150);
    
    if (isTalkingRef.current) {
      requestAnimationFrame(() => talk());
    }
  }, [sleep]);

  // Mark animation for notification
  const animateMark = useCallback(async () => {
    if (!isMarkAnimatingRef.current) {
      setEffectClass('');
      return;
    }
    
    setEffectClass('rotate-6');
    await sleep(500);
    setEffectClass('-rotate-6');
    await sleep(500);
    
    if (isMarkAnimatingRef.current) {
      requestAnimationFrame(() => animateMark());
    }
  }, [sleep]);

  // Mount effect
  useEffect(() => {
    blinkLoop();
    
    // Cleanup function
    return () => {
      isBlinkingRef.current = false;
      isTalkingRef.current = false;
      isMarkAnimatingRef.current = false;
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
    };
  }, [blinkLoop]);

  return (
    <div className={`relative ${avatarEffectClass}`} data-tauri-drag-region>
      {effectURL && (
        <img
          src={effectURL}
          className={`absolute pointer-events-none ${effectClass}`}
          alt=""
        />
      )}
      <div data-tauri-drag-region>
        <img
          src={actualEyesURL}
          className="absolute pointer-events-none"
          alt=""
        />
        <img
          src={actualAvatarURL}
          alt="AI Assistant Avatar"
          className="pointer-events-none z-2"
        />
      </div>
      
      {/* Inline styles for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-animate-bounce {
          animation: bounce 1s infinite;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        .custom-animate-ping {
          animation: ping 3s infinite;
        }
        @keyframes ping {
          0% {
            transform: scale(0.9);
          }
          75% {
            transform: scale(1);
          }
          100% {
            transform: scale(0.9);
          }
        }
        .custom-animate-expand {
          animation: expand 3s infinite;
        }
        @keyframes expand {
          0% {
            transform: scale(0.95);
          }
          50% {
            transform: scale(1);
          }
          100% {
            transform: scale(0.95);
          }
        }
        .rotate-6 {
          transform: rotate(6deg);
          transition: transform 0.3s ease;
        }
        .-rotate-6 {
          transform: rotate(-6deg);
          transition: transform 0.3s ease;
        }
        `
      }} />
    </div>
  );
};

export default DefaultAvatar;