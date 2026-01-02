import React from 'react';

interface OverlayIndicatorProps {
  visible: boolean;
  message?: string;
  children?: React.ReactNode;
}

const OverlayIndicator: React.FC<OverlayIndicatorProps> = ({ visible, message, children }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm select-none">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="w-16 h-16 border-4 border-t-transparent border-white rounded-full animate-spin shadow-lg" aria-label="Loading" />
        {message && (
          <span className="text-xl font-medium text-white drop-shadow-lg" role="status">{message}</span>
        )}
        {children}
      </div>
    </div>
  );
};

export default OverlayIndicator;
