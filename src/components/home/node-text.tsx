import React, { useState, useRef, useCallback, useEffect } from 'react';
type NodeProperty = { name: string; value?: string };

interface NodeTextProps {
  value: string;
  onChange: (value: string) => void;
  variables?: NodeProperty[]; // Optional for form usage
  placeholder?: string;
  label?: string;
  inputType?: 'text' | 'textarea'; // Single-line or multi-line
  charLimit?: number; // Character limit, default 256
  disabled?: boolean;
  onDrop?: (e: React.DragEvent<any>) => void;
  showControl?: boolean; // Show/hide edit/preview toggle
  isPassword?: boolean; // Enable password masking
  error?: string; // Error message to display
  required?: boolean; // Mark as required
  autoFocus?: boolean; // Auto-focus on mount
  autoComplete?: string; // Autocomplete attribute
  name?: string; // Form field name
  id?: string; // HTML id attribute
  description?: string; // Description to display
  className?: string; // Custom className
  style?: React.CSSProperties; // Custom inline styles
  height?: string | number; // New prop for custom height (e.g., '100px', 200)
  highlightColor?: string; // Add prop for custom highlight color
  textColor?: string; // Add prop for custom text color
  bgColor?: string; // Add prop for custom background color
  top?: boolean; // Add this new prop
  topClassName?: string; // Add this new prop
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'list'; // Add media type support
  mediaUrl?: string; // Add URL for media content
  filename?: string; // Add filename for documents
  mimeType?: string; // Add mimeType for documents
  showUpload?: boolean; // Add this new prop
  onFileUpload?: (file: File) => void; // Add this new prop
  uploadAccept?: string; // Add this new prop
  uploadLabel?: string; // Add this new prop
  showTopBar?: boolean; // Show/hide the top toolbar/label area
  showCounters?: boolean; // Show/hide bottom counters (characters/lines)
  placeholderIcon?: React.ReactNode; // Optional leading icon inside the input
}

export const NodeText: React.FC<NodeTextProps> = ({
  value = '',
  onChange,
  variables = [],
  placeholder = '',
  label,
  inputType = 'text',
  charLimit = 256,
  disabled = false,
  onDrop,
  showControl = false,
  isPassword = false,
  error,
  required = false,
  autoFocus = false,
  autoComplete = 'off',
  name,
  id,
  className = '',
  description,
  style,
  height, // New prop for custom height
  highlightColor = 'emerald',
  textColor = 'slate',
  bgColor = 'slate',
  top = false,
  topClassName = '',
  mediaType = '',
  mediaUrl,
  filename,
  mimeType,
  showUpload = false,
  onFileUpload,
  uploadAccept,
  uploadLabel,
  showTopBar = true,
  showCounters = true,
  placeholderIcon,
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [showDescription, setShowDescription] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (descriptionRef.current && !descriptionRef.current.contains(event.target as Node)) {
        setShowDescription(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const content = e.target.value;
    if (content.length <= charLimit) {
      setLocalValue(content);
      onChange(content);
    }
  }, [onChange, charLimit]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    if (variables.length === 0 || !inputRef.current) return;

    const variableName = e.dataTransfer.getData("text/plain");
    const start = inputRef.current.selectionStart || 0;
    const end = inputRef.current.selectionEnd || 0;
    const content = inputRef.current.value;
    const newTextBase = content.substring(0, start) + `{${variableName}}` + content.substring(end);
    const newText = newTextBase.slice(0, charLimit);
    const newCursorPos = Math.min(start + variableName.length + 2, charLimit);
    
    setLocalValue(newText);
    onChange(newText);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);
  }, [onChange, charLimit, variables]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const getHighlightColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      emerald: 'bg-emerald-500/10 text-emerald-600 rounded-md px-1.5 py-0.5',
      rose: 'bg-rose-500/10 text-rose-600 rounded-md px-1.5 py-0.5',
      light: 'bg-slate-500/10 text-slate-600 rounded-md px-1.5 py-0.5',
      green: 'bg-green-500/10 text-green-600 rounded-md px-1.5 py-0.5',
    };
    return colorMap[color] || colorMap.emerald;
  };

  const getTextColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      slate: 'text-slate-700',
      light: 'text-slate-700',
      dark: 'text-white',
    };
    return colorMap[color] || colorMap.light;
  };

  const getBgColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      slate: 'bg-slate-50',
      light: 'bg-slate-50',
      dark: 'bg-[#1e1e1e]',
    };
    return colorMap[color] || colorMap.light;
  };

  const renderHighlightedContent = () => {
    if (!localValue) {
      return <span className="text-slate-500">{placeholder}</span>;
    }

    // Split by newlines first, then by variables
    const lines = localValue.split('\n');
    return lines.map((line, lineIndex) => {
      const parts = line.split(/({[^}]+})/g);
      return (
        <div key={`line-${lineIndex}`} className="min-h-[1.5em]">
          {parts.map((part, index) => {
            if (part.startsWith('{') && part.endsWith('}')) {
              return (
                <span 
                  key={`var-${lineIndex}-${index}`} 
                  className={`inline-block ${getHighlightColorClass(highlightColor)} font-medium align-baseline`}
                >
                  {part}
                </span>
              );
            }
            return (
              <span 
                key={`text-${lineIndex}-${index}`} 
                className={`${getTextColorClass(textColor)} whitespace-pre-wrap`}
              >
                {part}
              </span>
            );
          })}
        </div>
      );
    });
  };

  const lineCount = inputType === 'textarea' ? localValue.split('\n').length : 0;

  const InputComponent = inputType === 'text' ? 'input' : 'textarea';

  // Determine height based on prop or default
  const getHeight = () => {
    if (height) {
      return typeof height === 'number' ? `${height}px` : height;
    }
    return inputType === 'text' ? '40px' : '100px'; // Default heights
  };

  const renderMediaPreview = () => {
    if (!mediaUrl) return null;

    const DownloadButton = () => (
      <a 
        href={mediaUrl} 
        download
        className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
        title="Download file"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </a>
    );

    switch (mediaType) {
      case 'image':
        return (
          <div className="border border-black rounded-lg overflow-hidden">
            <div className="bg-[#1e1e1e] p-2 flex items-center justify-between border-b">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-white text-sm truncate">{filename || 'Image'}</span>
              </div>
              <DownloadButton />
            </div>
            <div className="bg-[#1e1e1e] p-4">
              <img 
                src={mediaUrl} 
                alt={filename || 'Preview'} 
                className="w-full rounded-lg object-contain max-h-[400px]"
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="border border-black rounded-lg overflow-hidden">
            <div className="bg-[#1e1e1e] p-2 flex items-center justify-between border-b">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-white text-sm truncate">{filename || 'Video'}</span>
              </div>
              <DownloadButton />
            </div>
            <div className="bg-[#1e1e1e] p-4">
              <video 
                src={mediaUrl} 
                controls 
                className="w-full rounded-lg max-h-[400px]"
              />
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="border border-black rounded-lg overflow-hidden">
            <div className="bg-[#1e1e1e] p-2 flex items-center justify-between border-b">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-white text-sm truncate">{filename || 'Audio'}</span>
              </div>
              <DownloadButton />
            </div>
            <div className="bg-[#1e1e1e] p-4">
              <audio src={mediaUrl} controls className="w-full" />
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="border border-black rounded-lg overflow-hidden">
            <div className="bg-[#1e1e1e] p-2 flex items-center justify-between border-b">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-white text-sm truncate">{filename || 'Document'}</span>
              </div>
              <DownloadButton />
            </div>
            <div style={{scrollbarWidth: 'none', msOverflowStyle: 'none', overflow: 'hidden'}} className="bg-[#1e1e1e] p-4">
              {mimeType === 'application/pdf' ? (
                <object
                data={mediaUrl}
                type={mimeType}
                className="w-full bg-white rounded-lg"
                style={{ 
                  height: '500px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  overflow: 'hidden'
                }}
                name="media-preview"
              >
                  <p className="text-slate-400 text-sm">PDF Preview not available</p>
                </object>
              ) : mimeType?.startsWith('image/') ? (
                <img 
                  src={mediaUrl} 
                  alt={filename || 'Preview'} 
                  className="w-full rounded-lg object-contain max-h-[400px]"
                />
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-[#2e2e2e] rounded-lg">
                  <div className="text-center p-4">
                    <svg className="w-8 h-8 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-xs text-slate-400">
                      {filename || 'Document'}<br/>
                      <span className="text-slate-500">({mimeType})</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col`}>
      <div className={`relative ${!top && 'border border-black border-b-0'} rounded-lg`}>

    
        <div className={`rounded-lg  duration-150 ${
          error ? 'border-red-500 bg-red-50' : 
          isDraggingOver ? 'border-emerald-500 shadow-emerald-100' : 'border-slate-200 hover:border-slate-300'
        }`}>
          {showTopBar && (
          <div className={`flex items-center justify-between align-middle px-2 py-2  ${!top ? 'border-b border-slate-100 bg-slate-50 rounded-t-lg' : ''}`}>
            <div className="flex-1 flex justify-start items-center text-xs text-slate-500">
              {label && (
                <div className="flex items-center gap-1.5">
                  {description && (
                    <div className="relative" ref={descriptionRef}>
                      <button
                        title="Show description"
                        type="button"
                        onClick={() => setShowDescription(!showDescription)}
                        className="focus:outline-none"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 20 20" 
                          fill="currentColor" 
                          className="w-4 h-4 text-slate-400 hover:text-slate-600"
                        >
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {showDescription && (
                        <div className="absolute z-50 left-0 top-6 w-64 p-3 text-sm bg-white border border-slate-200 rounded-lg shadow-lg">
                          <div className="absolute -top-2 left-2 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45" />
                          <div className="relative text-slate-600">
                            {description}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <label htmlFor={id} className={`block text-sm font-bold ${!top ? topClassName : ''}`}>
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                </div>
              )}
            </div>
            {showControl && (
            <div className="inline-flex bottom-0 rounded-md border border-slate-200 bg-white p-1 min-w-[120px] shadow-sm">
              <button
                title="Edit"
                onClick={() => setEditorMode("edit")}
                className={`text-xs px-3 py-1 rounded-sm flex-1 transition-colors ${
                  editorMode === "edit" 
                    ? "bg-slate-100 text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Edit
              </button>
              <button
                title="Preview"
                onClick={() => setEditorMode("preview")}
                className={`text-xs px-3 py-1 rounded-sm flex-1 transition-colors ${
                  editorMode === "preview" 
                    ? "bg-slate-100 text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Preview
              </button>
            </div>
          )}
          </div>
          )}
          
          <div className="relative">
            <div className={editorMode === "edit" || !showControl ? 'block' : 'hidden'}>
              {/* optional leading icon */}
              {placeholderIcon && (
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {placeholderIcon}
                </div>
              )}
              {/* Clear icon button */}
              {localValue && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 focus:outline-none z-20"
                  style={{padding: 0, margin: 0}}
                  onClick={() => { setLocalValue(''); onChange(''); }}
                  tabIndex={-1}
                  aria-label="Clear input"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="14" y2="14"/><line x1="6" y1="14" x2="14" y2="6"/></svg>
                </button>
              )}
              <InputComponent
                ref={inputRef as any}
                value={localValue}
                onChange={handleInput}
                onDrop={onDrop || handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                disabled={disabled}
                placeholder={placeholder}
                maxLength={charLimit}
                className={`${className} w-full p-4 ${placeholderIcon ? 'pl-10' : ''} focus:outline-none ${getBgColorClass(bgColor)} text-sm 
                ${getTextColorClass(textColor)} leading-relaxed ${
                  inputType === 'text' ? '' : 'resize-y overflow-auto'
                } scrollbar-hide rounded-b-lg`}
                style={{
                  caretColor: textColor === 'light' ? '#334155' : 'light',
                  height: getHeight(),
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                spellCheck={false}
                type={isPassword ? 'password' : 'text'}
                id={id}
                name={name}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
              />
            </div>
            
            <div className={editorMode === "preview" && showControl ? 'block' : 'hidden'}>
              <div 
                className={`min-h-[100px] p-4 text-sm leading-relaxed ${getBgColorClass(bgColor)} overflow-auto whitespace-pre-wrap scrollbar-hide rounded-b-lg`}
                style={{
                  height: getHeight(),
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  resize: inputType === 'textarea' ? 'vertical' : 'none',
                  overflow: 'auto',
                }}
              >
                {renderHighlightedContent()}
              </div>
            </div>
          </div>
        </div>
        
        {isDraggingOver && (
          <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none border-2 border-emerald-500 border-dashed rounded-lg" />
        )}
      </div>
      
      {showCounters && (
        <div className="flex justify-between mt-1 text-xs text-slate-500 px-1">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5"></div>
            <span>Characters: {(localValue || '').length}/{charLimit}</span>
          </div>
          {inputType === 'textarea' && (
            <div className="flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5"></div>
              <span>Lines: {lineCount}</span>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5"></div>
          {error}
        </div>
      )}
      
      {/* Add media preview after the input */}
      {mediaType !== 'list' && renderMediaPreview()}
    </div>
  );
};