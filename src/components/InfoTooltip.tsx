import React from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content }) => {
  return (
    <div className="inline-flex items-center justify-center group relative">
      <Info className="w-4 h-4 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
      </div>
    </div>
  );
};

export default InfoTooltip;
