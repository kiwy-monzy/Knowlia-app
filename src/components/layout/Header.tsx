import React, { useState, useEffect, useRef } from 'react';
import { Menu as MenuIcon, X as XIcon, Minimize, Maximize, X, User, ChevronDown, Minus, Bell, Activity, RefreshCw, Menu } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTheme } from '../../contexts/ThemeContext';
import logoUd from '../../assets/logo_ud.png';
import './Header.css';

interface InternetNeighbourInfo {
  peer_id: number[];
  address: string;
  name: string;
  online: boolean;
  rtt_ms: number | null;
}

// Animated Network Stat Component
const AnimatedNetworkStat: React.FC<{ rtt: number | null; name: string }> = ({ rtt, name }) => {
  const [prevRtt, setPrevRtt] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (rtt !== null && prevRtt !== null && rtt !== prevRtt) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
    setPrevRtt(rtt);
  }, [rtt, prevRtt]);

  const getAnimationClass = () => {
    if (!isAnimating || !rtt || !prevRtt) return '';
    
    const change = rtt - prevRtt;
    if (Math.abs(change) < 5) return ''; // Minimal change, no animation
    
    if (change > 0) {
      return 'animate-pulse bg-red-800'; // Latency increased - red pulse
    } else {
      return 'animate-pulse bg-green-800'; // Latency decreased - green pulse
    }
  };

  const getLatencyColor = () => {
    if (!rtt) return 'text-gray-400';
    if (rtt < 50) return 'text-emerald-400';
    if (rtt < 100) return 'text-emerald-300';
    if (rtt < 150) return 'text-amber-300';
    if (rtt < 200) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md sidebar-3d-icon border border-black/50 transition-all duration-300 ${
        rtt && rtt < 200 ? 'bg-emerald-900' : 'bg-red-900'
      } ${getAnimationClass()} text-white`}
      title={`${name} - ${rtt ? `${rtt}ms` : 'Measuring...'}`}
    >
      <Activity className={`w-3 h-3 ${isAnimating ? 'animate-spin' : ''}`} />
      <span className="truncate max-w-[80px] font-medium">
        {name}
      </span>
      {rtt && (
        <span className={getLatencyColor()}>
          {rtt}ms
        </span>
      )}
    </div>
  );
};
interface HeaderComponentProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const HeaderComponent: React.FC<HeaderComponentProps> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  collapsed,
  onToggleCollapse,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showProfile, setShowProfile] = useState(true); // Always show profile
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [profileData, setProfileData] = useState({
    name: ' ',
    profile: '', // Base64 image
    about: '',
    college: ''
  });
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [internetNeighbours, setInternetNeighbours] = useState<InternetNeighbourInfo[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthWindowOpen, setIsAuthWindowOpen] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  // Check for OIDC cookies in session/local storage
  const checkOidcCookies = async (): Promise<boolean> => {
    // First check if auth window exists and can provide authentication status
    try {
      const authWindow = await WebviewWindow.getByLabel('auth');
      if (authWindow) {
        // Try to get authentication status from the auth window using invoke
        const isAuthenticated = await invoke<boolean>('check_auth_window_storage');
        
        if (isAuthenticated) {
          console.log('Found valid authentication in auth window');
          return true;
        }
      }
    } catch (error) {
      console.log('Failed to check auth window, falling back to local storage:', error);
    }
    
    // Enhanced token detection with better parsing
    const oidcKeyPatterns = [
      'oidc.user:https://login.udsm.ac.tz/oauth2/oidcdiscovery:',
      'oidc.user:',
      'auth_token',
      'access_token',
      'session_token'
    ];
    
    // Check sessionStorage first (more likely to have current session)
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const isOidcKey = oidcKeyPatterns.some(pattern => key.includes(pattern));
        
        if (isOidcKey) {
          const value = sessionStorage.getItem(key);
          if (value && value.length > 50) { // More stringent check for valid tokens
            try {
              const oidcData = JSON.parse(value);
              
              // Check for multiple token types (access_token, id_token, refresh_token)
              const hasValidTokens = !!(oidcData.access_token || oidcData.id_token || oidcData.refresh_token);
              
              if (hasValidTokens) {
                // Check expiration if available
                if (oidcData.expires_at) {
                  const currentTime = Math.floor(Date.now() / 1000);
                  const isValid = oidcData.expires_at > currentTime;
                  console.log('Session token - expires_at:', oidcData.expires_at, 'current:', currentTime, 'valid:', isValid);
                  if (isValid) {
                    console.log('Found valid OIDC token in sessionStorage:', key);
                    return true;
                  }
                } else {
                  // No expiration, assume valid
                  console.log('Found OIDC token without expiration in sessionStorage:', key);
                  return true;
                }
              }
            } catch (error) {
              // Check if it's a raw token (not JSON)
              if (value.startsWith('ey') && value.includes('.')) {
                console.log('Found raw JWT token in sessionStorage:', key);
                return true;
              }
            }
          }
        }
      }
    }
    
    // Check localStorage as fallback
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const isOidcKey = oidcKeyPatterns.some(pattern => key.includes(pattern));
        
        if (isOidcKey) {
          const value = localStorage.getItem(key);
          if (value && value.length > 50) { // More stringent check for valid tokens
            try {
              const oidcData = JSON.parse(value);
              
              // Check for multiple token types
              const hasValidTokens = !!(oidcData.access_token || oidcData.id_token || oidcData.refresh_token);
              
              if (hasValidTokens) {
                // Check expiration if available
                if (oidcData.expires_at) {
                  const currentTime = Math.floor(Date.now() / 1000);
                  const isValid = oidcData.expires_at > currentTime;
                  console.log('Local token - expires_at:', oidcData.expires_at, 'current:', currentTime, 'valid:', isValid);
                  if (isValid) {
                    console.log('Found valid OIDC token in localStorage:', key);
                    return true;
                  }
                } else {
                  // No expiration, assume valid
                  console.log('Found OIDC token without expiration in localStorage:', key);
                  return true;
                }
              }
            } catch (error) {
              // Check if it's a raw token (not JSON)
              if (value.startsWith('ey') && value.includes('.')) {
                console.log('Found raw JWT token in localStorage:', key);
                return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  };

  // Get session storage data from auth webview once using reliable Tauri command
  const getSessionDataFromAuthWindow = async (): Promise<any> => {
    try {
      // Use the new reliable command instead of eval()
      const sessionValue = await invoke<string | null>('get_auth_session_data');
      
      if (sessionValue) {
        try {
          const parsedData = JSON.parse(sessionValue);
          console.log('Session data retrieved from auth window:', parsedData);
          return parsedData;
        } catch (error) {
          console.log('Failed to parse session data:', error);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.log('Error getting session data from auth window:', error);
      return null;
    }
  };

  // Check if auth window exists and is visible
  const checkAuthWindowExists = async (): Promise<boolean> => {
    try {
      const authWindow = await WebviewWindow.getByLabel('auth');
      if (authWindow) {
        // Try to check if window is actually visible
        const isVisible = await authWindow.isVisible().catch(() => false);
        return isVisible;
      }
      return false;
    } catch (error) {
      console.log('Error checking auth window:', error);
      return false;
    }
  };

  // Toggle auth webview window
  const toggleAuthWebview = async () => {
    try {
      //console.log('Toggling auth window...');
      const windowExists = await checkAuthWindowExists();
     // console.log('Window exists before toggle:', windowExists);
      
      if (windowExists) {
        // Window exists, close it
        //console.log('Closing auth window...');
        await invoke('close_auth_window');
        setIsAuthWindowOpen(false);
        //console.log('Auth window close command sent');
      } else {
        // Window doesn't exist, create it
        //console.log('Creating auth window...');
        setIsAuthWindowOpen(true); // Set to true immediately for better UX
        await invoke('create_auth_window');
        //console.log('Auth window create command sent');
        
        // Get session data after opening window
        setTimeout(async () => {
          const data = await getSessionDataFromAuthWindow();
          if (data) {
            setSessionData(data);
            //console.log('Session data updated after opening window');
          }
        }, 2000); // Wait for window to fully load
      }
      
      // Wait a bit and then verify the actual state
      setTimeout(async () => {
        const actualState = await checkAuthWindowExists();
        setIsAuthWindowOpen(actualState);
        //console.log('Verified window state after toggle:', actualState);
        
        // Recheck authentication status
        const authenticated = await checkOidcCookies();
        setIsAuthenticated(authenticated);
        //console.log('Auth window toggled, rechecked authentication status:', authenticated);
      }, 1500); // Wait 1.5 seconds for window to be created/destroyed
    } catch (error) {
      console.error('Failed to toggle auth webview:', error);
    }
  };

  // Check authentication status and window state on mount and when window changes
  useEffect(() => {
    const checkAuthAndWindow = async () => {
      const authenticated = await checkOidcCookies();
      setIsAuthenticated(authenticated);
      //console.log('Initial authentication status:', authenticated);
      
      // Get session data once if authenticated
      if (authenticated) {
        const data = await getSessionDataFromAuthWindow();
        setSessionData(data);
      }
      
      // Check window state
      const windowExists = await checkAuthWindowExists();
      setIsAuthWindowOpen(windowExists);
      //console.log('Initial auth window state:', windowExists);
      
      // Force button state update after a short delay
      setTimeout(() => {
        checkAuthWindowExists().then(setIsAuthWindowOpen);
      }, 100);
    };

    // Check immediately on mount
    checkAuthAndWindow();
    
    // Only check window state periodically, not authentication
    const windowStateInterval = setInterval(async () => {
      const actualWindowState = await checkAuthWindowExists();
      setIsAuthWindowOpen(prevState => {
        if (prevState !== actualWindowState) {
          //console.log('Window state changed from', prevState, 'to', actualWindowState);
          // If window state changed, recheck authentication
          if (prevState !== actualWindowState) {
            checkOidcCookies().then(setIsAuthenticated);
          }
        }
        return actualWindowState;
      });
    }, 1000); // Check every second for faster updates
    return () => clearInterval(windowStateInterval);
  }, []);

  // Load profile data and set up background sync listeners
  useEffect(() => {
    let unlistenProfile: (() => void) | null = null;
    let unlistenUnreadCount: (() => void) | null = null;
    let unlistenInternetNeighbours: (() => void) | null = null;

    const setupBackgroundListeners = async () => {
      // Set up background listeners
      unlistenProfile = await listen<string>('user_profile_updated', (event) => {
        try {
          const profile = JSON.parse(event.payload);
          setProfileData({
            name: profile.name || 'User',
            profile: profile.profile || '',
            about: profile.about || '',
            college: profile.college || ''
          });
          setShowProfile(true);
        } catch (error) {
          console.error('Failed to parse profile update:', error);
        }
      });

      unlistenUnreadCount = await listen<number>('total_unread_count_updated', (event) => {
        setTotalUnreadCount(event.payload);
      });

      unlistenInternetNeighbours = await listen<InternetNeighbourInfo[]>('internet_neighbours_updated', (event) => {
        setInternetNeighbours(event.payload);
      });
    };

    setupBackgroundListeners();

    return () => {
      if (unlistenProfile) unlistenProfile();
      if (unlistenUnreadCount) unlistenUnreadCount();
      if (unlistenInternetNeighbours) unlistenInternetNeighbours();
    };
  }, []);

  useEffect(() => {
    const getPlatform = async () => {
      try {
        // Check if platform API is available in Tauri
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('get_platform');
        //console.log('Platform detected:', currentPlatform);
      } catch (err) {
        //console.log('Platform detection not available or failed:', err);
        // Fallback: detect from user agent
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Windows')) {
          // detectedPlatform = 'windows';
        } else if (userAgent.includes('Mac')) {
          // detectedPlatform = 'macos';
        } else if (userAgent.includes('Linux')) {
          // detectedPlatform = 'linux';
        }
        //console.log('Fallback platform detection:', detectedPlatform);
      }
    };
    
    // Only run platform detection once
    getPlatform();

    const checkMaximizeState = async () => {
      try {
        const appWindow = getCurrentWindow();
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        //console.error('Failed to check maximize state:', error);
      }
    };

    checkMaximizeState();

    const setupListener = async () => {
      try {
        const unlisten = await getCurrentWindow().onResized(() => {
          checkMaximizeState();
        });
        return unlisten;
      } catch (error) {
        //console.error('Failed to set up resize listener:', error);
        return null;
      }
    };

    let unlistenFn: (() => void) | null = null;
    setupListener().then(fn => { unlistenFn = fn; });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };

  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      //console.error('Minimize failed:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
      setIsMaximized(!isMaximized); // Toggle state immediately
    } catch (error) {
      //console.error('Maximize/Unmaximize failed:', error);
    }
  };



  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      //console.error('Close failed:', error);
    }
  };

  const handleDragStart = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch (error) {
      //console.error('Start dragging failed:', error);
    }
  };

  return (
    <div
      className={`flex justify-between items-center cursor-move h-14 rounded-t-5xl border-b border-black/20 px-3 pt-2 w-full header-container ${theme === 'light' ? 'theme-light' : ''}`}
    >
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden z-50 p-2 rounded-md ml-2"
      >
        {isMobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
      </button>
      
      {/* Collapse Sidebar Button */}
      {onToggleCollapse && (
        <button
          className="sidebar-3d-icon flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 text-white transition-all"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          <Menu size={16} />
        </button>
      )}
      
      {/* Internet Neighbours Display - Far Left */}
      <div className="flex items-center gap-2 ml-2">
        {internetNeighbours.filter(n => n.online).slice(0, 2).map((neighbour, index) => (
          <AnimatedNetworkStat
            key={index}
            rtt={neighbour.rtt_ms}
            name={neighbour.name}
          />
        ))}
        {internetNeighbours.filter(n => n.online).length > 2 && (
          <div className="text-[10px] text-muted-foreground px-1 animate-pulse">
            +{internetNeighbours.filter(n => n.online).length - 2} more
          </div>
        )}
      </div>
      
      <div className="flex items-center ">
      </div>
      <div 
        className="flex-1 flex items-center h-full text-sm font-medium select-none"
        onMouseDown={handleDragStart}
      >
        {/* drag area only, no status pill here */}
      </div>
      <div className="flex items-center gap-2">

        {showProfile && (
          <>
            {/* LMS Button - Shows dynamic text based on window state */}
            <div className="relative group">
              <button
                onClick={toggleAuthWebview}
                className={`flex items-center gap-2 px-3 py-1 rounded-md sidebar-3d-icon border border-black/50 transition-colors relative ${
                  isAuthWindowOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
                title={`UDSM LMS - ${isAuthWindowOpen ? 'Close' : 'Open'}`}
              >
                <img 
                  src={logoUd} 
                  alt="UDSM Logo" 
                  className="w-5 h-5 object-contain"
                />
                <span className="text-white text-sm font-medium whitespace-nowrap">
                  {isAuthWindowOpen ? 'Close' : 'Open'}
                </span>
              </button>
              
              {/* Session Data Tooltip - Shows on hover */}
              {sessionData && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900 text-white p-3 rounded-md shadow-lg border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-green-400 mb-2">Session Information</div>
                    <div><span className="text-gray-400">User:</span> {sessionData.profile?.username || 'N/A'}</div>
                    <div><span className="text-gray-400">Email:</span> {sessionData.profile?.email || 'N/A'}</div>
                    <div><span className="text-gray-400">Organization:</span> {sessionData.profile?.org_name || 'N/A'}</div>
                    <div><span className="text-gray-400">Expires:</span> {sessionData.expires_at ? new Date(sessionData.expires_at * 1000).toLocaleString() : 'N/A'}</div>
                    <div><span className="text-gray-400">Token Type:</span> {sessionData.token_type || 'N/A'}</div>
                    <div><span className="text-gray-400">Scope:</span> {sessionData.scope || 'N/A'}</div>
                    <div className="pt-2 border-t border-gray-600">
                      <button
                        onClick={async () => {
                          console.log('Manual auth check triggered');
                          const windowExists = await checkAuthWindowExists();
                          setIsAuthWindowOpen(windowExists);
                          console.log('Manual check - window exists:', windowExists);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        🔄 Refresh State
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            


            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center sidebar-3d-icon gap-2 px-3 py-1 border border-black/50 rounded-md hover:opacity-90 transition-colors profile-button"
              >
                <User size={16} />
                <span className="text-sm">
                  {profileData.name}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>
              {isProfileOpen && (
                <div
                  className="absolute top-9 right-0 mt-2 w-64 border border-black/20 rounded-md shadow-lg z-50 profile-dropdown"
                >
                  <div className="p-4 border-b border-black/20">
                    <div className="flex items-center gap-3">
                      {profileData.profile && profileData.profile.startsWith('data:image') ? (
                        <img 
                          src={profileData.profile} 
                          alt="Profile" 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {profileData.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium profile-name truncate">
                          {profileData.name}
                        </div>
                        <div className="text-sm profile-username truncate opacity-70">
                          {profileData.college || 'No college set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <button 
          onClick={handleMinimize} 
          className="sidebar-3d-icon inline-flex justify-center items-center border border-black/50 w-10 h-10 rounded-md bg-green-500 transition-colors"
          aria-label="Minimize"
        >
          <Minus size={18} color="#fff" />
        </button>
        <button 
          onClick={handleMaximize} 
          className="sidebar-3d-icon inline-flex justify-center items-center border border-black/50 w-10 h-10 rounded-md bg-blue-500 transition-colors"
        >
          {isMaximized ? <Minimize size={16} color="#fff" /> : <Maximize size={16} color="#fff" />}
        </button>
        <button 
          onClick={handleClose} 
          className="sidebar-3d-icon inline-flex justify-center border-radius-full border border-black/50 items-center w-10 h-10 bg-red-500 rounded-md text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
};