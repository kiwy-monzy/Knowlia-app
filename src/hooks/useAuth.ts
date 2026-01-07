import { useState, useEffect } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

export interface InternetNeighbourInfo {
  peer_id: number[];
  address: string;
  name: string;
  online: boolean;
  rtt_ms: number | null;
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthWindowOpen, setIsAuthWindowOpen] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);

  // Check for OIDC cookies in session/local storage
  const checkOidcCookies = async (): Promise<boolean> => {
    try {
      const authWindow = await WebviewWindow.getByLabel('auth');
      if (authWindow) {
        const isAuthenticated = await invoke<boolean>('check_auth_window_storage');
        if (isAuthenticated) {
          console.log('Found valid authentication in auth window');
          return true;
        }
      }
    } catch (error) {
      console.log('Failed to check auth window, falling back to local storage:', error);
    }
    
    const oidcKeyPatterns = [
      'oidc.user:https://login.udsm.ac.tz/oauth2/oidcdiscovery:',
      'oidc.user:',
      'auth_token',
      'access_token',
      'session_token'
    ];
    
    // Check sessionStorage first
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
        const value = sessionStorage.getItem(key);
        if (value && value.length > 50) {
          try {
            const oidcData = JSON.parse(value);
            const hasValidTokens = !!(oidcData.access_token || oidcData.id_token || oidcData.refresh_token);
            
            if (hasValidTokens) {
              if (oidcData.expires_at) {
                const currentTime = Math.floor(Date.now() / 1000);
                const isValid = oidcData.expires_at > currentTime;
                if (isValid) return true;
              } else {
                return true;
              }
            }
          } catch (error) {
            if (value.startsWith('ey') && value.includes('.')) {
              return true;
            }
          }
        }
      }
    }
    
    // Check localStorage as fallback
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && oidcKeyPatterns.some(pattern => key.includes(pattern))) {
        const value = localStorage.getItem(key);
        if (value && value.length > 50) {
          try {
            const oidcData = JSON.parse(value);
            const hasValidTokens = !!(oidcData.access_token || oidcData.id_token || oidcData.refresh_token);
            
            if (hasValidTokens) {
              if (oidcData.expires_at) {
                const currentTime = Math.floor(Date.now() / 1000);
                const isValid = oidcData.expires_at > currentTime;
                if (isValid) return true;
              } else {
                return true;
              }
            }
          } catch (error) {
            if (value.startsWith('ey') && value.includes('.')) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  };

  // Get session storage data from auth webview
  const getSessionDataFromAuthWindow = async (): Promise<any> => {
    try {
      const sessionValue = await invoke<string | null>('get_auth_session_data');
      if (sessionValue) {
        try {
          return JSON.parse(sessionValue);
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
      const windowExists = await checkAuthWindowExists();
      
      if (windowExists) {
        await invoke('close_auth_window');
        setIsAuthWindowOpen(false);
      } else {
        setIsAuthWindowOpen(true);
        await invoke('create_auth_window');
        
        setTimeout(async () => {
          const data = await getSessionDataFromAuthWindow();
          if (data) {
            setSessionData(data);
          }
        }, 2000);
      }
      
      setTimeout(async () => {
        const actualState = await checkAuthWindowExists();
        setIsAuthWindowOpen(actualState);
        const authenticated = await checkOidcCookies();
        setIsAuthenticated(authenticated);
      }, 1500);
    } catch (error) {
      console.error('Failed to toggle auth webview:', error);
    }
  };

  useEffect(() => {
    const checkAuthAndWindow = async () => {
      const authenticated = await checkOidcCookies();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const data = await getSessionDataFromAuthWindow();
        setSessionData(data);
      }
      
      const windowExists = await checkAuthWindowExists();
      setIsAuthWindowOpen(windowExists);
      
      setTimeout(() => {
        checkAuthWindowExists().then(setIsAuthWindowOpen);
      }, 100);
    };

    checkAuthAndWindow();
    
    const windowStateInterval = setInterval(async () => {
      const actualWindowState = await checkAuthWindowExists();
      setIsAuthWindowOpen(prevState => {
        if (prevState !== actualWindowState) {
          checkOidcCookies().then(setIsAuthenticated);
        }
        return actualWindowState;
      });
    }, 1000);
    
    return () => clearInterval(windowStateInterval);
  }, []);

  return {
    isAuthenticated,
    isAuthWindowOpen,
    sessionData,
    toggleAuthWebview,
    checkOidcCookies
  };
};
