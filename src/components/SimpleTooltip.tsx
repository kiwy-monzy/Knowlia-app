import React from 'react';
import { Info } from 'lucide-react';

interface SimpleTooltipProps {
  content: string;
  children?: React.ReactNode;
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({ content, children }) => {
  return (
    <div className="relative inline-block group">
      {children || <Info className="w-4 h-4 cursor-help" />}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45"></div>
      </div>
    </div>
  );
};

export default SimpleTooltip;
