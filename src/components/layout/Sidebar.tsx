import React, { useEffect, useState, useRef } from 'react';
import { Home, Users, Settings, ChevronLeft, Circle, ChevronRight, Bot, Brain, Server, Database, Calendar, CheckSquare, MapPin } from 'lucide-react';
import clickSound from '@/assets/mouse-click.mp3';
import { useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useChatContext } from '@/contexts/ChatContext';
import { listen } from '@tauri-apps/api/event';
import './Sidebar.css';
import logo from '@/assets/logo.png';
import LiquidGlass from 'liquid-glass-react'
import packageJson from '../../../package.json';
interface User {
  id: string;
  name: string;
  verified: boolean;
  blocked: boolean;
  connections: any[];
  q8id?: string;
  key_base58?: string;
  connectivity?: number;
  profile?: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { setCurrentView, channels, setCurrentChannel } = useChatContext();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(clickSound);
    audioRef.current.volume = 0.3; // Set volume to 30%
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playClickSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Rewind to the start
      audioRef.current.play().catch(e => console.error('Error playing sound:', e));
    }
  };

  const handleNavigation = (route: string) => {
    playClickSound();
    navigate(route);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersDataString = await invoke<string>('get_all_users');
        const usersData: any[] = JSON.parse(usersDataString);
        
        // Convert to the format expected by the Sidebar
        const convertedUsers = usersData.map(user => ({
          id: user.base.id,
          name: user.base.name,
          verified: user.base.verified,
          profile: user.base.profile,
          connections: user.connections,
          blocked: user.base.blocked,
        }));
        
        setUsers(convertedUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]); // Set empty array as fallback
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();

    // Load sidebar collapse state from global config on component mount
    const loadCollapseState = async () => {
      try {
        const config = await invoke<any>('get_global_config');
        const isCollapsed = config.sidebar_collapse === 'true';
        // Only update if different to avoid infinite loops
        if (isCollapsed !== collapsed) {
          onToggleCollapse();
        }
      } catch (error) {
        console.error('Failed to load sidebar collapse state:', error);
      }
    };

    loadCollapseState();
  }, []);

  // Save sidebar collapse state to global config whenever it changes
  useEffect(() => {
    const saveCollapseState = async () => {
      try {
        await invoke('set_config_value', { 
          key: 'sidebar_collapse', 
          value: collapsed.toString() 
        });
      } catch (error) {
        console.error('Failed to save sidebar collapse state:', error);
      }
    };
    saveCollapseState();
  }, [collapsed]);

  const tabs = [
    { id: 'home', name: 'Home', icon: Home, route: '/' },
    { id: 'group', name: 'Chats', icon: Users, route: '/groups' },
    { id: 'map', name: 'Map', icon: MapPin, route: '/map' },
    { id: 'storage', name: 'Notes', icon: Database, route: '/storage' },
    //{ id: 'timetable', name: 'Timetable', icon: Calendar, route: '/timetable' },
    //{ id: 'tasks', name: 'Tasks', icon: CheckSquare, route: '/tasks' },
    //{ id: 'ai', name: 'AI', icon: Bot, route: '/ai' },
    //{ id: 'gpt', name: 'GPT', icon: Brain, route: '/gpt' },
    { id: 'settings', name: 'Settings', icon: Settings, route: '/settings' },
  ];

  // Filter out blocked users and sort by online status
  const filteredUsers = React.useMemo(() => 
    users
      .filter((user) => !user.blocked)
      .sort((a, b) => {
        const aOnline = a.connections && a.connections.length > 0;
        const bOnline = b.connections && b.connections.length > 0;
        if (aOnline === bOnline) return 0;
        return aOnline ? -1 : 1;
      })
      .map((user) => ({
        id: user.id,
        name: user.name || '',
        profile: user.profile || '',
        isOnline: user.connections && user.connections.length > 0,
        role: user.verified ? 'verified' : 'member',
        status: (user.connections && user.connections.length > 0) ? 'online' : 'offline'
      })),
    [users]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'dnd':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-gray-500';
    }
  };

  const handleStartChat = async (contactId: string) => {
    try {
      // Navigate to the chat page first
      navigate('/groups');
      
      // Check if a direct chat already exists
      const existingChannel = channels.find(channel => 
        channel.isDirectChat && 
        channel.members.some(member => member.id === contactId)
      );

      if (existingChannel) {
        // If chat exists, navigate to it
        setCurrentChannel(existingChannel);
        setCurrentView('chat');
      } else {
        // If no chat exists, create one
        await invoke<string>('get_or_create_direct_chat', { contactId });
        
        // Refresh channels to get the new group
        // Note: You might need to implement a refresh function in ChatContext
        // For now, we'll navigate to chat view
        setCurrentView('chat');
      }
    } catch (error) {
      //console.error('Failed to start chat:', error);
    }
  };

  return (
    <div className={`h-screen sticky top-0 z-30 bg-[#1a1a1a] flex flex-col transition-all duration-300 ease-in-out ${collapsed ? 'w-17' : 'w-full max-w-[240px] sm:w-[170px] sm:max-w-none'}`}>
      <div className='flex flex-col md:flex-row items-center px-2 py-4 pt-5'> 
        <img 
          src={logo} 
          alt='Logo' 
          className='w-8 h-8 md:w-10 ml-1 md:h-10 mr-2 md:mr-4'
        />
        <div className='text-white truncate text-xl font-bold font-luckiest-guy text-center md:text-left'>
          <span>KNOWLIA</span>
        </div>
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex flex-col items-center gap-1 z-10 overflow-y-auto ">
        {tabs.map((tab, index) => {
          const IconComponent = tab.icon;
          const isActive = pathname === tab.route;
          return (
            <div key={`${tab.id}-${index}`} className="w-full">
              <div
                className={`py-2 ${isActive ? 'rounded-l-3xl sidebar-active' : 'sidebar-inactive'}`}
              >
                <div
                  className={`flex items-center gap-3 cursor-pointer w-full justify-center sm:justify-start px-2 ${isActive ? 'selected' : ''} relative group`}
                  onClick={() => handleNavigation(tab.route)}
                >
                  <div
                    className={`sidebar-3d-icon h-12 w-12 border border-black/50 flex items-center justify-center text-white rounded-2xl hover:rounded-xl transition-all duration-200 relative ${isActive ? 'selected' : 'sidebar-inactive'}`}
                  >
                    <IconComponent size={24} color="#fff" />
                  </div>
                  {!collapsed && (
                    <span
                      className={`text-md font-medium max-w-[110px] truncate transition-opacity duration-300 ${isActive ? '' : 'text-white'} hidden sm:inline-block`}
                    >
                      {tab.name}
                    </span>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-red-500 text-white text-sm rounded opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 group-hover:opacity-100">
                      {tab.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Scrollable users list */}
      <div className="flex-1 bg-[#1a1a1a] overflow-y-auto">
        <div className="grid grid-cols-1">
          {loading ? (
            <div className="px-2 py-2 text-sm text-gray-400"></div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-2 py-2 text-sm text-gray-400"></div>
          ) : (
            <React.Fragment key="users-list">
              {filteredUsers.map((user) => (
                <div key={user.id} className='flex-2'>
                  <div className="flex items-center gap-2 py-2 pl-2 pr-2 cursor-pointer hover:bg-gray-700/50 relative group"
                       onClick={() => {
                  playClickSound();
                  handleStartChat(user.id);
                }}>
                    <div className="relative">
                      {/* User Avatar */}
                      <div className="sidebar-3d-icon border border-black/50 h-12 w-12 flex items-center justify-center bg-gray-600 text-white rounded-2xl hover:rounded-3xl transition-all duration-200 relative overflow-hidden">
                        <img 
                          src={user.profile} 
                          alt={user.name}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      </div>
                      {/* Status Indicator */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(user.status)}`} />
                    </div>
                    <div className="flex flex-col min-w-0 w-[110px] transition-opacity duration-300">
                      <div className="font-medium text-white leading-tight truncate flex items-center">
                        {user.name}
                        {user.role === 'verified' && (
                          <span className="ml-1 text-blue-400" title="Verified">✓</span>
                        )}
                      </div>
                      <div className="text-gray-300 capitalize text-xs leading-tight truncate">
                        {user.role}
                      </div>
                    </div>
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-red-500 text-white text-sm rounded opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 group-hover:opacity-100">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs opacity-90">{user.role}</div>
                      </div>
                    )}
                  </div>
                  <div className="w-full h-0.5 border-b border-gray-700"></div>
                </div>
              ))}
            </React.Fragment>
          )}
        </div>
      </div>

      {/* Version Info - Fixed at Bottom */}
      <div className="mt-auto py-4 bg-[#1a1a1a]">
        <div className="w-full flex flex-col items-center justify-center">
          <span className="text-xs text-zinc-400 text-center font-mono">v{packageJson.version}</span>
        </div>
      </div>  
    </div>
  );
};

export default Sidebar;