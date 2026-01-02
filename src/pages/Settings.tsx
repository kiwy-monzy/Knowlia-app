import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import SettingsSidebar from '@/components/settings/SettingsSidebar';
import ProfileSettings from '@/components/settings/pages/ProfileSettings';
import NotificationSettings from '@/components/settings/pages/NotificationSettings';
import MCPSettings from '@/components/settings/pages/MCPSettings';
import AppearanceSettings from '@/components/settings/pages/AppearanceSettings';
import PrivacySettings from '@/components/settings/pages/PrivacySettings';
import AdvancedSettings from '@/components/settings/pages/AdvancedSettings';
import CredentialSettings from '@/components/settings/pages/CredentialSettings';
import AboutSettings from '@/components/settings/pages/AboutSettings';
import NetworkSettings from '@/components/settings/pages/NetworkSettings';


function SettingsContent() {
  const { currentSection } = useSettings();

  const renderContent = () => {
    switch (currentSection) {
      case 'profile':
        return <ProfileSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'mcp':
        return <MCPSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'advanced':
        return <AdvancedSettings />;
      case 'credentials':
        return <CredentialSettings />;
      case 'network':
        return <NetworkSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      <div className="hidden md:block">
        <SettingsSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#fafafa]">
        <div className="flex-1 min-h-0 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function Settings() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}

export default Settings;
