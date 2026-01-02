import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarHeaderProps {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  className?: string;
  /**
   * colorMode: 'yellow' for yellow/black, 'light' for light background (black text), 'default' for dark sidebar (white text)
   */
  colorMode?: 'yellow' | 'light' | 'default';
  action?: React.ReactNode;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ title, Icon, className = 'bg-sidebar', colorMode, action }) => {
  const { theme } = useTheme();

  // Determine effectiveColorMode based on params or theme
  let effectiveColorMode: 'yellow' | 'light' | 'default' = colorMode || 'default';

  if (!colorMode) {
    if ((theme as string) === 'light' || (theme as string) === 'theme-light') effectiveColorMode = 'light';
    else if ((theme as string) === 'yellow' || (theme as string) === 'theme-yellow') effectiveColorMode = 'yellow';
    else effectiveColorMode = 'default';
  }

  let titleClass = 'font-bold truncate';
  let iconClass = 'w-6 h-6 flex-shrink-0 mr-2';
  let textColor = 'text-volt-text';
  let iconColor = 'text-black';
  let textShadow = '0 1px 2px rgba(0,0,0,0.18)';

  if (effectiveColorMode === 'yellow') {
    textColor = 'text-black';
    iconColor = 'text-black';
    textShadow = '0 1px 2px rgba(0,0,0,0.12)';
  } else if (effectiveColorMode === 'light') {
    textColor = 'text-gray-900';
    iconColor = 'text-cyan-700';
    textShadow = '0 1px 2px rgba(255,255,255,0.10)';
  }

  return (
    <div
      className={`h-12 min-h-12 flex items-center justify-between gap-x-2 px-4 border-b border-black/20 sticky top-0 z-10 ${className}`}
      style={{ boxSizing: 'border-box' }}
      role="banner"
      aria-label={title}
    >
      <div className="flex items-center gap-x-2 flex-1 min-w-0">
        <Icon className={`${iconClass} ${iconColor} flex-shrink-0`} aria-hidden="true" />
        <h2
          className={`${titleClass} ${textColor} flex-1`}
          style={{ textShadow }}
        >
          {title}
        </h2>
      </div>
      {action && <div className="flex items-center flex-shrink-0 ml-auto">{action}</div>}
    </div>
  );
};

export default SidebarHeader;