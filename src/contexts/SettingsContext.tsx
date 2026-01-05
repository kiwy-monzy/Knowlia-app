import React, { createContext, useContext, useState, ReactNode } from 'react';

export type SettingsSection = 
  | 'profile' 
  | 'notifications' 
  | 'credentials'
  | 'mcp' 
  | 'appearance' 
  | 'privacy' 
  | 'advanced' 
  | 'network'
  | 'bluetooth'
  | 'about';

export interface NotificationSettings {
  enabled: boolean;
  sound: string;
  volume: number;
  desktopNotifications: boolean;
  messageNotifications: boolean;
  eventReminders: {
    enabled: boolean;
    defaultTimes: number[]; // minutes before event
    sound: string;
    volume: number;
  };
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  colorScheme: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  sidebarCollapsed: boolean;
}

export interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  blockedUsers: string[];
  twoFactorAuth: boolean;
}

export interface AdvancedSettings {
  developerMode: boolean;
  debugMode: boolean;
  cacheSize: number;
  autoCleanup: boolean;
  performanceMode: 'balanced' | 'performance' | 'battery';
}

export interface SystemSettings {
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  language: string;
  proxyEnabled: boolean;
  proxyUrl: string;
  autoBackup: boolean;
  backupInterval: number;
}

interface SettingsContextType {
  currentSection: SettingsSection;
  setCurrentSection: (section: SettingsSection) => void;
  
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  
  appearanceSettings: AppearanceSettings;
  updateAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  
  privacySettings: PrivacySettings;
  updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;
  
  advancedSettings: AdvancedSettings;
  updateAdvancedSettings: (settings: Partial<AdvancedSettings>) => void;
  
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [currentSection, setCurrentSection] = useState<SettingsSection>('profile');
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: true,
    sound: 'default',
    volume: 80,
    desktopNotifications: true,
    messageNotifications: true,
    eventReminders: {
      enabled: true,
      defaultTimes: [60, 30, 15], // 1 hour, 30 min, 15 min
      sound: 'alarm',
      volume: 90,
    },
    doNotDisturb: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
  });

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: 'dark',
    colorScheme: 'default',
    fontSize: 'medium',
    density: 'comfortable',
    sidebarCollapsed: false,
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    dataSharing: false,
    analytics: false,
    blockedUsers: [],
    twoFactorAuth: false,
  });

  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    developerMode: false,
    debugMode: false,
    cacheSize: 500,
    autoCleanup: true,
    performanceMode: 'balanced',
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    launchOnStartup: false,
    minimizeToTray: true,
    language: 'en',
    proxyEnabled: false,
    proxyUrl: '',
    autoBackup: true,
    backupInterval: 7,
  });

  const updateNotificationSettings = (settings: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...settings }));
  };

  const updateAppearanceSettings = (settings: Partial<AppearanceSettings>) => {
    setAppearanceSettings(prev => ({ ...prev, ...settings }));
  };

  const updatePrivacySettings = (settings: Partial<PrivacySettings>) => {
    setPrivacySettings(prev => ({ ...prev, ...settings }));
  };

  const updateAdvancedSettings = (settings: Partial<AdvancedSettings>) => {
    setAdvancedSettings(prev => ({ ...prev, ...settings }));
  };

  const updateSystemSettings = (settings: Partial<SystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...settings }));
  };

  return (
    <SettingsContext.Provider
      value={{
        currentSection,
        setCurrentSection,
        notificationSettings,
        updateNotificationSettings,
        appearanceSettings,
        updateAppearanceSettings,
        privacySettings,
        updatePrivacySettings,
        advancedSettings,
        updateAdvancedSettings,
        systemSettings,
        updateSystemSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
