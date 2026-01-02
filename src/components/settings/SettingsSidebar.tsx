import { User, Bell, Settings as SettingsIcon, Info, Wifi } from 'lucide-react';
import { useSettings, SettingsSection } from '@/contexts/SettingsContext';
import SidebarHeader from '@/components/SidebarHeader';

const SettingsSidebar = () => { 
  const { currentSection, setCurrentSection } = useSettings();

  const sections: { id: SettingsSection; name: string; icon: any; description: string }[] = [
    { id: 'profile', name: 'Profile', icon: User, description: 'Manage your account' },
    //{ id: 'notifications', name: 'Notifications', icon: Bell, description: 'Alerts & reminders' },
    //{ id: 'credentials', name: 'Credentials', icon: Key, description: 'Credentials' },
    //{ id: 'mcp', name: 'MCP', icon: Plug, description: 'Model Context Protocol' },
    //{ id: 'appearance', name: 'Appearance', icon: Palette, description: 'Theme & display' },
    //{ id: 'privacy', name: 'Privacy', icon: Shield, description: 'Security & privacy' },
    { id: 'network', name: 'Network', icon: Wifi, description: 'Network topology & peers' },
    //{ id: 'advanced', name: 'Advanced', icon: SettingsIcon, description: 'Developer options' },
    { id: 'about', name: 'About', icon: Info, description: 'App information' },
  ];

  return (
    <div className="w-64 bg-sidebar rounded-l-[2rem] border-r border-sidebar-border flex flex-col h-full overflow-hidden flex-shrink-0 max-md:w-full">
      <SidebarHeader
        title="Settings"
        Icon={SettingsIcon}
        className="bg-sidebar border-sidebar-border rounded-tl-[2rem]"
      />

      <div className="flex-1 overflow-y-auto pb-2">
        <div className="p-2 space-y-1">
          {sections.map((section) => {
            const IconComponent = section.icon;
            const isActive = currentSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all
                  backdrop-blur-md border
                  ${isActive
                    ? 'bg-primary/20 border-primary/40 text-primary font-semibold shadow-md'
                    : 'bg-muted/50 border-muted hover:bg-muted shadow-sm'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/20' : 'bg-muted'}`}>
                    <IconComponent className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{section.name}</div>
                    <div className="text-xs text-muted-foreground">{section.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SettingsSidebar;
