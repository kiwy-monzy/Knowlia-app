import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  parseMessage,
  createDemoMessage,
  isCurrentlyThinking,
  MessagePart,
} from '@/utils/messageParser';
import SendMessage from '@/components/avatar/SendMessage';
import ChatCloud from '@/components/avatar/ChatCloud';
import { Settings, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { globalConfig } from '@/lib/globalConfig';
import DefaultAvatar from '@/components/avatar/DefaultAvatar';

import { getScreenshotsContext } from '@/utils/commands';

const AVATAR_HEIGHT = 175;
const AVATAR_WIDTH = 40;
const WINDOW_PADDING = 40;
const GAP = 8;
const DEFAULT_WINDOW_SIZE = {
  width: AVATAR_WIDTH + WINDOW_PADDING * 2,
  height: AVATAR_HEIGHT + WINDOW_PADDING,
};

const Avatar: React.FC = () => {
  // Refs
  const chatCloudRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [fullMessageContent, setFullMessageContent] = useState<string>('');
  const [messageParts, setMessageParts] = useState<MessagePart[]>([]);
  const [isMessageVisible, setIsMessageVisible] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isCallingModel, setIsCallingModel] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [withScreenshotsContext, setWithScreenshotsContext] = useState<boolean>(false);
  
  // Derived state
  const isProcessing = useMemo(() => 
    isCallingModel || isStreaming || isThinking, 
    [isCallingModel, isStreaming, isThinking]
  );
  
  // Update window size function
  const updateWindowSize = useCallback(() => {
    console.log('updateWindowSize called, isMessageVisible:', isMessageVisible);
    let newWidth: number, newHeight: number;

    if (isMessageVisible && chatCloudRef.current) {
      const cloudElement = chatCloudRef.current.firstElementChild as HTMLElement;
      console.log('chatCloudRef.current:', chatCloudRef.current);
      console.log('cloudElement:', cloudElement);
      
      if (cloudElement) {
        // Force a reflow before measuring
        cloudElement.offsetHeight;
        
        const maxHeight = 560;
        const scrollHeight = cloudElement.scrollHeight;
        const clientHeight = cloudElement.clientHeight;
        const actualHeight = Math.min(scrollHeight || clientHeight, maxHeight);
        
        console.log('Measurements:', { scrollHeight, clientHeight, actualHeight });

        newWidth = 400 + WINDOW_PADDING * 2;
        newHeight = actualHeight + AVATAR_HEIGHT + GAP + WINDOW_PADDING * 2;
        console.log('Calculated new size:', { newWidth, newHeight, actualHeight });
      } else {
        newWidth = DEFAULT_WINDOW_SIZE.width;
        newHeight = DEFAULT_WINDOW_SIZE.height;
        console.log('Using default size (no cloud element)');
      }
    } else {
      newWidth = DEFAULT_WINDOW_SIZE.width;
      newHeight = DEFAULT_WINDOW_SIZE.height;
      console.log('Using default size (message not visible)');
    }

    console.log('Calling resize_avatar_window with:', { width: newWidth, height: newHeight });
    invoke("resize_avatar_window", {
      width: newWidth,
      height: newHeight,
    }).catch(err => console.error('Failed to resize window:', err));
  }, [isMessageVisible]);

  // Effect for window resizing
  useEffect(() => {
    const timer = setTimeout(() => {
      updateWindowSize();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [isMessageVisible, updateWindowSize]);

  // Effect for parsing message content
  useEffect(() => {
    const parsedParts = parseMessage(fullMessageContent);
    setMessageParts(parsedParts);
    
    if (isStreaming) {
      setIsThinking(isCurrentlyThinking(fullMessageContent));
    }
    
    if (isCallingModel && fullMessageContent.length > 0) {
      setIsCallingModel(false);
      setCustomPrompt('');
    }
    
    if (error) {
      setIsCallingModel(false);
      setIsStreaming(false);
      setIsThinking(false);
      setWithScreenshotsContext(false);
    }
  }, [fullMessageContent, isStreaming, isCallingModel, error]);

  // Effect for window resize on message parts change
  useEffect(() => {
    if (messageParts.length > 0) {
      const timer = setTimeout(() => {
        updateWindowSize();
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [messageParts, updateWindowSize]);

  // Add ResizeObserver to track content size changes
  useEffect(() => {
    if (!chatCloudRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        console.log('Resize observed:', entry.contentRect);
        if (isMessageVisible) {
          updateWindowSize();
        }
      }
    });

    const cloudElement = chatCloudRef.current.firstElementChild;
    if (cloudElement) {
      resizeObserver.observe(cloudElement);
      console.log('ResizeObserver attached to cloud element');
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isMessageVisible, updateWindowSize]);

  // Event handlers
  const showMessage = useCallback((message: string) => {
    setFullMessageContent(message);
    setIsMessageVisible(true);
    setTimeout(() => {
      updateWindowSize();
    }, 100);
  }, [updateWindowSize]);

  const hideMessage = useCallback(() => {
    if (!isMessageVisible) return;
    setIsMessageVisible(false);
  }, [isMessageVisible]);

  const toggleMessage = useCallback(() => {
    if (isMessageVisible) {
      hideMessage();
    } else if (fullMessageContent || error) {
      setIsMessageVisible(true);
    }
  }, [isMessageVisible, fullMessageContent, error, hideMessage]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') hideMessage();
  }, [hideMessage]);

  const callModel = useCallback(async (stream: boolean) => {
    const prompt = customPrompt.trim();

    if (!prompt) {
      setError('Prompt cannot be empty');
      return;
    }

    setIsCallingModel(true);
    setError('');
    setFullMessageContent('');
    
    setTimeout(() => {
      updateWindowSize();
    }, 100);

    let extraContext = '';

    if (withScreenshotsContext) {
      try {
        const context = await getScreenshotsContext();
        extraContext = `${context}\n\n`;
      } catch (err) {
        console.error('Failed to get screenshots context:', err);
      }
    }

    try {
      const newSessionId = await invoke<number>('call_model', {
        prompt: `${extraContext}${prompt}`,
        stream,
        sessionId: chatSessionId,
      });
      setChatSessionId(newSessionId);
      console.log(newSessionId);
    } catch (err) {
      setError(`Call failed: ${err}`);
      setIsCallingModel(false);
    } finally {
      setWithScreenshotsContext(false);
    }
  }, [customPrompt, withScreenshotsContext, chatSessionId, updateWindowSize]);

  const stopModel = useCallback(async () => {
    try {
      await invoke('stop_model');
    } catch (err) {
      console.error('Failed to stop model:', err);
      setError(`Failed to stop model: ${err}`);
    }
  }, []);

  const openConfigWindow = useCallback(async () => {
    try {
      await invoke('create_main_window');
    } catch (err) {
      console.error('Failed to open config window:', err);
      setError(`Failed to open config: ${err}`);
    }
  }, []);

  const newChat = useCallback(() => {
    setChatSessionId(null);
    showMessage('*Waiting for user input*...');
  }, [showMessage]);

  // Mount effects
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Listen for call chunks
      const unlistenChunk = await listen<string>('call-chunk', (event) => {
        if (!isMessageVisible) {
          setIsMessageVisible(true);
        }
        setIsStreaming(true);
        setFullMessageContent(prev => prev + event.payload);
      });
      unlisteners.push(unlistenChunk);

      // Listen for tool calls
      const unlistenToolCall = await listen<string>('tool-call', (event) => {
        setCurrentTool(event.payload);
      });
      unlisteners.push(unlistenToolCall);

      // Listen for call completion
      const unlistenComplete = await listen('call-complete', () => {
        setIsStreaming(false);
        setIsThinking(false);
      });
      unlisteners.push(unlistenComplete);

      // Listen for errors
      const unlistenErrors = await listen<string>('error', (event) => {
        setError(event.payload);
        setIsStreaming(false);
        setIsCallingModel(false);
        setIsThinking(false);
        setTimeout(() => {
          updateWindowSize();
        }, 50);
      });
      unlisteners.push(unlistenErrors);

      // Listen for suggestions
      const unlistenSuggestion = await listen<number>('suggestion', (event) => {
        setIsCallingModel(true);
        setChatSessionId(event.payload);
        if (event.payload === -1) {
          setFullMessageContent('');
          setTimeout(() => {
            updateWindowSize();
          }, 100);
        }
      });
      unlisteners.push(unlistenSuggestion);

      // Listen for cancellation
      const unlistenCancelled = await listen('call-cancelled', () => {
        setError('');
        setIsCallingModel(false);
        setIsStreaming(false);
        setIsThinking(false);
        
        if (fullMessageContent) {
          let updatedContent = fullMessageContent;
          if (isCurrentlyThinking(fullMessageContent)) {
            updatedContent += '</think>';
          }
          setFullMessageContent(updatedContent + '\n\n*... Model stopped by user*');
        } else {
          setFullMessageContent('*Model stopped by user*');
          setIsMessageVisible(true);
        }
      });
      unlisteners.push(unlistenCancelled);

      // Listen for config updates
      const unlistenSetConfigValue = await listen('set-config-value', async () => {
        await globalConfig.loadConfig();
      });
      unlisteners.push(unlistenSetConfigValue);
    };

    setupListeners().catch(console.error);

    // Show demo message
    const demoMessage = createDemoMessage();
    showMessage(demoMessage);

    // Initialize background tasks if enabled
    if (globalConfig.enable_background_tasks) {
      invoke('init_background_task_manager').catch(console.error);
    }

    // Cleanup function
    return () => {
      unlisteners.forEach(unlisten => unlisten());
    };
  }, [fullMessageContent, isMessageVisible, globalConfig, showMessage, updateWindowSize]);

  // Window event listeners
  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [handleKeydown]);

  return (
    <div
      className="w-screen h-screen bg-transparent overflow-hidden cursor-grab select-none relative font-sans active:cursor-grabbing p-5"
      data-tauri-drag-region
    >

      {/* Avatar container */}
      <div
        ref={avatarContainerRef}
        className="absolute -bottom-4 -right-2 scale-[75%] overflow-hidden transition-all duration-300 ease-out z-2"
        onClick={toggleMessage}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggleMessage()}
        data-tauri-drag-region
      >
        <DefaultAvatar
          isStreaming={isStreaming}
          isCallingModel={isCallingModel}
          isFocused={isFocused}
          isThinking={isThinking}
        />
      </div>

      {/* Focused actions */}
      {isFocused && (
        <div
          className={`absolute bottom-2 ${isMessageVisible ? "right-[110px]" : "right-[80px]"} z-30 transition delay-150  duration-300 ease-in-out`}
          style={{ animation: 'fadeIn 0.3s ease-in-out' }}
        >
          {isMessageVisible && (
            <Button
              className="h-8 w-26 px-2"
              size="sm"
              variant="secondary"
              onClick={newChat}
              title="New Chat"
              disabled={isStreaming}
            >
              <SquarePlus className="w-5 h-5" />
              New Chat
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            onClick={openConfigWindow}
            title="Open Configuration"
          >
            <Settings className="w-8 h-8" />
          </Button>
        </div>
      )}

      {/* Send message component */}
      {isMessageVisible && isFocused && (
        <SendMessage
          customPrompt={customPrompt}
          withScreenshotsContext={withScreenshotsContext}
          isProcessing={isProcessing}
          onSend={() => callModel(true)}
          onStop={stopModel}
          onPromptChange={setCustomPrompt}
          onScreenshotsToggle={setWithScreenshotsContext}
        />
      )}

      {/* Chat cloud */}
      <div ref={chatCloudRef}>
        <ChatCloud
          parts={messageParts}
          error={error}
          isProcessing={isProcessing}
          visible={isMessageVisible}
          currentTool={currentTool}
        />
      </div>
    </div>
  );
};

export default Avatar;