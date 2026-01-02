import React from 'react';
import { Bot, BotOff } from 'lucide-react';
import SimpleTooltip from './SimpleTooltip';

interface AssistantEnabledIconProps {
  isAssistantEnabled: boolean;
}

const AssistantEnabledIcon: React.FC<AssistantEnabledIconProps> = ({ isAssistantEnabled }) => {
  const tooltipContent = isAssistantEnabled 
    ? "Assistant is Active" 
    : "Assistant is Disabled - No data processed, no suggestions";

  return (
    <SimpleTooltip content={tooltipContent}>
      <div className="-ml-2 flex items-center gap-1 z-30">
        {isAssistantEnabled ? (
          <>
            <div
              className="ml-1 mt-1 absolute w-3 h-2.5 bg-green-500/90 rounded animate-ping"
            ></div>
            <Bot className="size-5 text-green-500 z-2" />
            <div
              className="ml-1 mt-1 absolute w-3 h-2.5 bg-accent rounded-xs z-1"
            ></div>
          </>
        ) : (
          <BotOff className="size-5 text-red-500" />
        )}
      </div>
    </SimpleTooltip>
  );
};

export default AssistantEnabledIcon;
