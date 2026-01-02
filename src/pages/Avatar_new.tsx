import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Settings, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DefaultAvatar from '@/components/avatar/DefaultAvatar';
import SendMessage from '@/components/avatar/SendMessage';
import ChatCloud from '@/components/avatar/ChatCloud';
import { parseMessage, createDemoMessage, isCurrentlyThinking, type MessagePart } from '@/utils/messageParser';
import { getScreenshotsContext } from '@/utils/commands';

// --- Constants ---
const AVATAR_HEIGHT = 80;
const AVATAR_WIDTH = 40;
const WINDOW_PADDING = 40;
const GAP = 8;
const DEFAULT_WINDOW_SIZE = {
  width: AVATAR_WIDTH + WINDOW_PADDING * 2,
  height: AVATAR_HEIGHT + WINDOW_PADDING,
};

const Avatar: React.FC = () => {
  // --- State ---
  const chatCloudRef = useRef<HTMLDivElement | null>(null);
  const avatarContainerRef = useRef<HTMLDivElement | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState('');
  const [fullMessageContent, setFullMessageContent] = useState(''); // Holds the raw, concatenated string
  const [messageParts, setMessageParts] = useState<MessagePart[]>([]); // Holds the parsed components
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isCallingModel, setIsCallingModel] = useState<boolean>(false);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [withScreenshotsContext, setWithScreenshotsContext] = useState(false);

  const isProcessing = isCallingModel || isStreaming || isThinking;

  const updateWindowSize = useCallback(() => {
    let newWidth: number, newHeight: number;

    if (isMessageVisible && chatCloudRef.current) {
      const cloudElement = chatCloudRef.current.firstElementChild;
      if (cloudElement) {
        const maxHeight = 560;
        const actualHeight = Math.min(
          cloudElement.scrollHeight || cloudElement.clientHeight,
          maxHeight,
        );

        newWidth = 400 + WINDOW_PADDING * 2;
        newHeight = actualHeight + AVATAR_HEIGHT + GAP + WINDOW_PADDING * 2;
      } else {
        // Fallback if the element isn't there
        newWidth = DEFAULT_WINDOW_SIZE.width;
        newHeight = DEFAULT_WINDOW_SIZE.height;
      }
    } else {
      newWidth = DEFAULT_WINDOW_SIZE.width;
      newHeight = DEFAULT_WINDOW_SIZE.height;
    }

    invoke('resize_avatar_window', {
      width: newWidth,
      height: newHeight,
    });
  }, [isMessageVisible]);

  // --- Effects ---
  useEffect(() => {
    // Add a small delay to ensure content is rendered before measuring
    const timeout = setTimeout(() => {
      updateWindowSize();
    }, 50);

    return () => clearTimeout(timeout);
  }, [isMessageVisible, updateWindowSize]);

  useEffect(() => {
    // When the raw message content changes, re-parse it
    const parts = parseMessage(fullMessageContent);
    setMessageParts(parts);
    
    if (isStreaming) {
      setIsThinking(isCurrentlyThinking(fullMessageContent));
    }

    // Keep isCallingModel true until we have content
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

  useEffect(() => {
    // When parts update, trigger a window resize
    if (messageParts.length > 0) {
      const timeout = setTimeout(() => {
        updateWindowSize();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [messageParts, updateWindowSize]);

  // --- Event Handlers ---
  const showMessage = useCallback((message: string) => {
    setFullMessageContent(message);
    setIsMessageVisible(true);
    const timeout = setTimeout(() => {
      updateWindowSize();
    }, 100);
    return () => clearTimeout(timeout);
  }, [updateWindowSize]);

  const callModel = async (stream: boolean) => {
    const prompt = customPrompt.trim();

    if (!prompt) {
      setError('Prompt cannot be empty');
      return;
    }

    setIsCallingModel(true);
    setError('');
    setFullMessageContent('');
    const timeout = setTimeout(() => {
      updateWindowSize();
    }, 100);

    let extraContext = '';

    if (withScreenshotsContext) {
      const context = await getScreenshotsContext();
      extraContext = `${context}\n\n`;
    }

    try {
      const sessionId = await invoke<number>('call_model', {
        prompt: `${extraContext}${prompt}`,
        stream,
        sessionId: null,
      });
      console.log(sessionId);
    } catch (err) {
      setError(`Call failed: ${err}`);
      setIsCallingModel(false);
    } finally {
      setWithScreenshotsContext(false);
      clearTimeout(timeout);
    }
  };

  const stopModel = async () => {
    try {
      await invoke('stop_model');
    } catch (err) {
      console.error('Failed to stop model:', err);
      setError(`Failed to stop model: ${err}`);
    }
  };

  const openConfigWindow = async () => {
    try {
      await invoke('create_main_window');
    } catch (err) {
      console.error('Failed to open config window:', err);
      setError(`Failed to open config: ${err}`);
    }
  };

  const newChat = () => {
    showMessage('*Waiting for user input*...');
  };

  // --- Event Listeners Setup ---
  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenChunk = await listen<string>('call-chunk', (event) => {
        if (!isMessageVisible) {
          setIsMessageVisible(true);
        }
        setIsStreaming(true);
        // Append to the raw string. The useEffect will handle parsing and thinking state.
        setFullMessageContent(prev => prev + event.payload);
        console.log(fullMessageContent);
      });

      const unlistenToolCall = await listen<string>('tool-call', (event) => {
        setCurrentTool(event.payload);
      });

      const unlistenComplete = await listen('call-complete', () => {
        setIsStreaming(false);
        setIsThinking(false);
      });

      const unlistenErrors = await listen<string>('error', (event) => {
        setError(event.payload);
        setIsStreaming(false);
        setIsCallingModel(false);
        setIsThinking(false);
        const timeout = setTimeout(() => {
          updateWindowSize();
        }, 50);
        return () => clearTimeout(timeout);
      });

      const unlistenSuggestion = await listen<number>('suggestion', (event) => {
        setIsCallingModel(true);
        if (event.payload === -1) {
          setFullMessageContent('');
          const timeout = setTimeout(() => {
            updateWindowSize();
          }, 100);
          return () => clearTimeout(timeout);
        }
      });

      const unlistenCancelled = await listen('call-cancelled', () => {
        setError('');
        setIsCallingModel(false);
        setIsStreaming(false);
        setIsThinking(false);
        if (fullMessageContent) {
          // Close any open thinking blocks before adding the stopped message
          let updatedContent = fullMessageContent;
          if (isCurrentlyThinking(fullMessageContent)) {
            updatedContent += '';
          }
          setFullMessageContent(updatedContent + '\n\n*... Model stopped by user*');
        } else {
          setFullMessageContent('*Model stopped by user*');
          setIsMessageVisible(true);
        }
      });

      const unlistenSetConfigValue = await listen('set-config-value', async () => {
        // This would need to be implemented based on your globalConfig store
        // await globalConfig.loadConfig();
      });

      // Cleanup function
      return () => {
        unlistenChunk();
        unlistenToolCall();
        unlistenComplete();
        unlistenErrors();
        unlistenSuggestion();
        unlistenCancelled();
        unlistenSetConfigValue();
      };
    };

    const cleanup = setupEventListeners();

    // Initialize demo message
    const demoMessage = createDemoMessage();
    showMessage(demoMessage);

    // Initialize background tasks if enabled
    // if (globalConfig.enable_background_tasks) {
    //   await invoke('init_background_task_manager');
    // }

    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // --- Window Event Handlers ---
  useEffect(() => {
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css"
      />
      <div
        className="w-screen h-screen bg-transparent overflow-hidden cursor-grab select-none relative font-sans active:cursor-grabbing p-5"
        data-tauri-drag-region
      >
        <div
          ref={avatarContainerRef}
          className="absolute -bottom-4 -right-2 scale-[75%] overflow-hidden transition-all duration-300 ease-out z-2"
          onClick={() => setIsMessageVisible(!isMessageVisible)}
          role="button"
          tabIndex={0}
          title="Toggle avatar visibility"
          data-tauri-drag-region
        >
          <DefaultAvatar
            isStreaming={isStreaming}
            isCallingModel={isCallingModel}
            isFocused={isFocused}
            isThinking={isThinking}
          />
        </div>

        {isFocused && (
          <div
            className={`absolute bottom-2 ${isMessageVisible ? 'right-[110px]' : 'right-[80px]'} z-30 transition delay-150 duration-300 ease-in-out`}
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
              className=""
              variant="secondary"
              size="icon"
              onClick={openConfigWindow}
              title="Open Configuration"
            >
              <Settings className="w-8 h-8" />
            </Button>
          </div>
        )}

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

        <div ref={chatCloudRef}>
          <ChatCloud
            parts={messageParts}
            error={error}
            isProcessing={isProcessing}
            visible={isMessageVisible}
            onContentChanged={updateWindowSize}
            currentTool={currentTool}
            isThinking={isThinking}
          />
        </div>
      </div>
    </>
  );
};

export default Avatar;
