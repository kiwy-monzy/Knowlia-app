import React, { useState, useRef, useCallback, useEffect } from 'react';
import { parseMessage, MessagePart } from '@/utils/messageParser';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Send, 
  Square, 
  Brain, 
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getAllSessions, getSessionMessages } from '@/utils/commands';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  parsedContent?: MessagePart[];
}

interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
}

const Gpt: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const [input, setInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isCallingModel, setIsCallingModel] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState<boolean>(false);
  const [newSessionTitle, setNewSessionTitle] = useState<string>('');

  const isProcessing = isCallingModel || isStreaming;

  // Format time for display
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / 60000);
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  // Parse date from backend
  const parseDate = (dateValue: string | number): Date => {
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    if (typeof dateValue === 'number') {
      return new Date(dateValue * 1000);
    }
    return new Date();
  };

  // Load sessions from backend
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const chatSessions = await getAllSessions();
      const formattedSessions: Session[] = chatSessions.map(session => ({
        id: session.id?.toString() || '',
        title: session.title,
        createdAt: parseDate(session.created_at as any),
        updatedAt: parseDate(session.updated_at as any),
        lastMessage: session.last_message
      }));
      
      formattedSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      setSessions(formattedSessions);
      
      if (!currentSessionId && formattedSessions.length > 0) {
        setCurrentSessionId(formattedSessions[0].id);
        try {
          const sessionMessages = await getSessionMessages(formattedSessions[0].id);
          const formattedMessages: Message[] = sessionMessages.map(msg => ({
            id: msg.id?.toString() || Date.now().toString(),
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: parseDate(msg.created_at as any),
            toolsUsed: msg.tools_used || [],
            parsedContent: parseMessage(msg.content)
          }));
          setMessages(formattedMessages);
        } catch (error) {
          console.error('Failed to load session messages:', error);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [currentSessionId]);

  // Handle session selection
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (currentSessionId === sessionId) return;
    
    setCurrentSessionId(sessionId);
    setMessages([]);
    setError('');
    setStreamingContent('');
    
    try {
      const sessionMessages = await getSessionMessages(sessionId);
      const formattedMessages: Message[] = sessionMessages.map(msg => ({
        id: msg.id?.toString() || Date.now().toString(),
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: parseDate(msg.created_at as any),
        toolsUsed: msg.tools_used || [],
        parsedContent: parseMessage(msg.content)
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      setError('Failed to load session messages');
      setMessages([]);
    }
  }, [currentSessionId]);

  // Create new session
  const handleCreateSession = useCallback(async () => {
    if (!newSessionTitle.trim()) return;
    
    try {
      setCurrentSessionId(null);
      setMessages([]);
      setInput(newSessionTitle.trim());
      setIsCreateSessionModalOpen(false);
      const titleToUse = newSessionTitle.trim();
      setNewSessionTitle('');
      
      setIsCallingModel(true);
      setError('');
      setStreamingContent('');
      
      const newSessionId = await invoke<number>('call_model', {
        prompt: titleToUse,
        stream: true,
        sessionId: null,
      });
      
      if (newSessionId) {
        setCurrentSessionId(newSessionId.toString());
        setTimeout(() => {
          loadSessions();
        }, 500);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('Failed to create session. Please try again.');
      setIsCallingModel(false);
    }
  }, [newSessionTitle, loadSessions]);

  // Delete session
  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          handleSessionSelect(remainingSessions[0].id);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      setError('Failed to delete session. Please try again.');
    }
  }, [currentSessionId, sessions, handleSessionSelect]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  // Call model
  const callModel = useCallback(async (stream: boolean) => {
    const prompt = input.trim();
    if (!prompt) {
      setError('Prompt cannot be empty');
      return;
    }

    setIsCallingModel(true);
    setError('');
    setStreamingContent('');
    
    try {
      const newSessionId = await invoke<number>('call_model', {
        prompt,
        stream,
        sessionId: currentSessionId ? parseInt(currentSessionId) : null,
      });
      
      if (newSessionId) {
        setCurrentSessionId(newSessionId.toString());
        setTimeout(() => loadSessions(), 500);
      }
    } catch (err) {
      setError(`Call failed: ${err}`);
      setIsCallingModel(false);
    }
  }, [input, currentSessionId, loadSessions]);

  const stopModel = useCallback(async () => {
    try {
      await invoke('stop_model');
    } catch (err) {
      console.error('Failed to stop model:', err);
      setError(`Failed to stop model: ${err}`);
    }
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      parsedContent: parseMessage(input.trim())
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError('');

    try {
      await callModel(true);
    } catch (err) {
      console.error('Failed to process message:', err);
      setError('Failed to process message. Please try again.');
      setIsCallingModel(false);
      setIsStreaming(false);
    }
  }, [input, isProcessing, callModel]);

  const handleStopGeneration = useCallback(() => {
    stopModel();
  }, [stopModel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [input, handleSendMessage]);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, []);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Load sessions on component mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Setup event listeners for streaming responses
  useEffect(() => {
    let unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      const unlistenChunk = await listen<string>('call-chunk', (event) => {
        setIsStreaming(true);
        setIsCallingModel(false);
        
        setStreamingContent(prev => prev + event.payload);
      });
      unlisteners.push(unlistenChunk);

      const unlistenComplete = await listen('call-complete', () => {
        setIsStreaming(false);
        setIsCallingModel(false);
        
        if (streamingContent) {
          const assistantMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: streamingContent,
            timestamp: new Date(),
            parsedContent: parseMessage(streamingContent)
          };
          setMessages(prev => [...prev, assistantMessage]);
          setStreamingContent('');
          setTimeout(() => loadSessions(), 500);
        }
      });
      unlisteners.push(unlistenComplete);

      const unlistenErrors = await listen<string>('error', (event) => {
        setError(event.payload);
        setIsStreaming(false);
        setIsCallingModel(false);
      });
      unlisteners.push(unlistenErrors);

      const unlistenCancelled = await listen('call-cancelled', () => {
        setError('');
        setIsCallingModel(false);
        setIsStreaming(false);
        
        if (streamingContent) {
          const finalContent = streamingContent + '\n\n*... Model stopped by user*';
          const assistantMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: finalContent,
            timestamp: new Date(),
            parsedContent: parseMessage(finalContent)
          };
          setMessages(prev => [...prev, assistantMessage]);
          setStreamingContent('');
        }
      });
      unlisteners.push(unlistenCancelled);
    };

    setupListeners().catch(console.error);

    return () => {
      unlisteners.forEach(unlisten => unlisten());
    };
  }, [loadSessions, streamingContent]);

  // Adjust textarea height
  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Parse streaming content into parts for display
  const streamingParts = parseMessage(streamingContent);
  const hasThinking = streamingContent.includes('<thinking>');

  // Session Item Component
  const SessionItem = ({ session }: { session: Session }) => {
    const isActive = currentSessionId === session.id;

    return (
      <div
        onClick={() => handleSessionSelect(session.id)}
        className={cn(
          'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-left cursor-pointer',
          isActive
            ? 'bg-[#1a1a1a] text-white border border-[#1a1a1a]'
            : 'hover:bg-gray-100 text-gray-900'
        )}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
            isActive 
              ? 'bg-white/20 text-white' 
              : 'bg-gray-200 text-gray-600'
          )}>
            <MessageSquare className="h-4 w-4" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn(
              'font-medium text-sm truncate',
              isActive && 'font-semibold text-white'
            )}>
              {session.title}
            </span>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 flex-shrink-0 flex items-center justify-center rounded hover:bg-red-100 transition-colors"
              onClick={(e) => handleDeleteSession(session.id, e)}
            >
              <Trash2 className="w-3 h-3 text-gray-500 hover:text-red-500" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              "text-xs truncate flex-1",
              isActive ? "text-white/80" : "text-gray-500"
            )}>
              {session.lastMessage && session.lastMessage.length > 30 
                ? `${session.lastMessage.substring(0, 30)}...` 
                : session.lastMessage || 'New chat'}
            </p>
            <span className={cn(
              "text-[10px] flex-shrink-0 ml-2",
              isActive ? "text-white/60" : "text-gray-400"
            )}>
              {formatTime(session.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render message content
  const renderMessageContent = (parts: MessagePart[]) => {
    return (
      <div className="space-y-3">
        {parts.map((part, idx) => (
          <div key={idx} className="min-w-0">
            {part.type === 'markdown' && (
              <div 
                className="whitespace-pre-wrap break-words overflow-wrap-anywhere prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ 
                  __html: part.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
                    .replace(/\n/g, '<br>')
                }} 
              />
            )}
            {part.type === 'thinking' && (
              <div className="mt-4 mb-2">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Thinking Process</span>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed bg-white/50 rounded-lg p-3">
                    {part.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Top Bar */}
      <div className="w-full px-6 py-4 border-b border-gray-200 bg-white min-h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden h-9 w-9 p-0 rounded-lg border border-gray-200"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a1a1a] to-gray-800 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              {sessions.find(s => s.id === currentSessionId)?.title || 'AI Assistant'}
            </h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
          {sidebarOpen ? 'Hide' : 'Show'} Sidebar
        </Button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div 
          ref={sidebarRef}
          className={cn(
            'flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out z-10',
            sidebarOpen ? 'w-64 md:w-72 lg:w-80' : 'w-0 overflow-hidden'
          )}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Chats</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {sessions.length}
              </span>
            </div>
            <Button 
              onClick={() => setIsCreateSessionModalOpen(true)}
              className="w-full justify-center gap-2 bg-gradient-to-r from-[#1a1a1a] to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white shadow-sm"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>
          
          {/* Sessions List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600">No chats yet</p>
                  <p className="text-xs text-gray-500 mt-1">Start a new conversation</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <SessionItem key={session.id} session={session} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Messages Area - FIXED LAYOUT */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 py-6 pb-32 space-y-6">
              {messages.length === 0 && !isProcessing ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                  <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3">How can I help you today?</h3>
                  <p className="text-gray-600 max-w-md text-center text-base">
                    Ask me anything! I can help with writing, analysis, coding, problem-solving, and much more.
                  </p>
                </div>
              ) : (
                <>
                  {/* Messages with proper spacing */}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-4 md:gap-6 mb-4 last:mb-0',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role !== 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      <div className={cn(
                        'flex-1 min-w-0 max-w-[85%] md:max-w-[80%]',
                        message.role === 'user' && 'flex justify-end'
                      )}>
                        <div className={cn(
                          'rounded-2xl px-4 py-3 shadow-sm',
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-[#1a1a1a] to-gray-800 text-white rounded-br-md'
                            : 'bg-gradient-to-b from-gray-50 to-white border border-gray-100 rounded-bl-md'
                        )}>
                          {message.role === 'assistant' && message.parsedContent ? (
                            renderMessageContent(message.parsedContent)
                          ) : (
                            <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere text-white/95 leading-relaxed">
                              {message.content}
                            </div>
                          )}
                          {/* Message timestamp */}
                          <div className={cn(
                            "text-xs mt-2",
                            message.role === 'user' ? "text-white/70" : "text-gray-500"
                          )}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-700">U</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-4 md:gap-6 justify-start mb-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                        <div className="relative">
                          <Brain className="w-4 h-4 text-blue-600" />
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[80%]">
                        <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gradient-to-b from-gray-50 to-white border border-gray-100 shadow-sm">
                          {renderMessageContent(streamingParts)}
                          {hasThinking && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span>Thinking...</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            Streaming...
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Processing indicator (when waiting for response) */}
                  {isCallingModel && !isStreaming && (
                    <div className="flex gap-4 md:gap-6 justify-start mb-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      </div>
                      <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[80%]">
                        <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gradient-to-b from-gray-50 to-white border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-sm text-gray-600 font-medium">
                              Processing...
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Empty div for scroll reference - positioned ABOVE input */}
                  <div ref={messagesEndRef} className="h-0" />
                </>
              )}
            </div>
          </div>

          {/* Input Area - FIXED POSITION */}
          <div className="border-t border-gray-200 bg-white/95 backdrop-blur-sm sticky bottom-0 z-20">
            <div className="max-w-3xl lg:max-w-4xl mx-auto p-4 md:p-6">
              <div className="relative">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        adjustTextareaHeight();
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message here..."
                      disabled={isProcessing}
                      rows={1}
                      className={cn(
                        'w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'text-base placeholder:text-gray-500 leading-relaxed',
                        'transition-all duration-200 shadow-sm',
                        'min-h-[56px] max-h-[200px]'
                      )}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      {isProcessing ? (
                        <Button
                          onClick={handleStopGeneration}
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 shadow-sm"
                        >
                          <Square className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSendMessage}
                          disabled={!input.trim()}
                          size="sm"
                          className={cn(
                            'h-9 w-9 p-0 rounded-lg transition-all duration-200 shadow-sm',
                            input.trim() 
                              ? 'bg-gradient-to-r from-[#1a1a1a] to-gray-800 text-white hover:from-gray-800 hover:to-gray-900' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-300'
                          )}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {error && (
                  <div className="mt-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <span className="font-medium">Error:</span> {error}
                    </p>
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500 text-center">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300">Enter</kbd> to send • 
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 mx-1">Shift</kbd> + 
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 mx-1">Enter</kbd> for new line
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      <Dialog open={isCreateSessionModalOpen} onOpenChange={setIsCreateSessionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">New Chat</DialogTitle>
            <DialogDescription className="text-gray-600">
              Give your chat session a descriptive title to easily find it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="e.g., Python code review, Essay help, Brainstorming..."
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSession();
                }
              }}
              className="text-base py-2.5"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              onClick={handleCreateSession}
              disabled={!newSessionTitle.trim()}
              className="w-full bg-gradient-to-r from-[#1a1a1a] to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white text-base py-2.5 shadow-sm"
            >
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gpt;