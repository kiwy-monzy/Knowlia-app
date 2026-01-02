import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SiteInfo } from "../types/moodle";

interface NetworkStats {
  latency_ms?: number;
  is_online?: boolean;
  gateway_name?: string;
  gateway_addr?: string;
  gateway_latency_ms?: number;
  gateway_online?: boolean;
}

interface SiteContextType {
  siteInfo: SiteInfo;
  testConnection: (opts?: any) => void;
  assignmentCount: number;
  courseCount: number;
  refreshCounts: () => Promise<void>;
  isLoadingCounts: boolean;
  networkStats?: NetworkStats;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export const SiteProvider = ({ children }: { children: ReactNode }) => {
  const [siteInfo, setSiteInfo] = useState<SiteInfo>({} as SiteInfo);
  const [assignmentCount, setAssignmentCount] = useState<number>(0);
  const [courseCount, setCourseCount] = useState<number>(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);
  const [networkStats, setNetworkStats] = useState<NetworkStats | undefined>(undefined);

  const testConnection = (_opts?: any) => {};

  useEffect(() => {
    // Fetch current user from qaul first
    const initializeUser = async () => {
      try {
        // Try to get current qaul user
        const user = await invoke<{ name: string; id: string; keys: string }>('get_current_user');
        if (user && user.name) {
          setSiteInfo((prev: SiteInfo) => ({
            ...prev,
            username: user.name,
            fullname: user.name,
            // Note: qaul user.id is a string (PeerId), but SiteInfo.userid expects number
            // So we don't set userid here - it's only for Moodle compatibility
          }));
          console.log('Loaded qaul user:', user.name);
        }
      } catch (error) {
        console.error('Failed to fetch current user from qaul:', error);
        
        // Fallback: try to get site info from Moodle
        try {
          const siteData = await invoke<SiteInfo>('get_site_info');
          if (siteData) {
            setSiteInfo(siteData);
            console.log('Loaded Moodle site info as fallback');
          }
        } catch (err) {
          console.error('Failed to get site info:', err);
          // Set a default user if both fail
          setSiteInfo((prev: SiteInfo) => ({
            ...prev,
            username: 'User',
            fullname: 'Local User',
          }));
        }
      }
    };

    initializeUser();
  }, []);

  const refreshCounts = useCallback(async () => {
    setIsLoadingCounts(true);
    try {
      const [assignments, courses] = await Promise.all([
        invoke<number>('get_assignment_count'),
        invoke<number>('get_enrolled_course_count'),
      ]);
      setAssignmentCount(assignments);
      setCourseCount(courses);
    } catch (error) {
      console.error('Failed to fetch counts:', error);
      // Keep existing values on error
    } finally {
      setIsLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // Fetch network stats periodically
  useEffect(() => {
    const fetchNetworkStats = async () => {
      try {
        const stats = await invoke<NetworkStats>('get_network_stats');
        setNetworkStats(stats);
      } catch (error) {
        console.error('Failed to fetch network stats:', error);
      }
    };

    fetchNetworkStats();
    
    // Refresh every 2 seconds
    const interval = setInterval(fetchNetworkStats, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <SiteContext.Provider
      value={{
        siteInfo,
        testConnection,
        assignmentCount,
        courseCount,
        refreshCounts,
        isLoadingCounts,
        networkStats,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
};

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within a SiteProvider");
  return ctx;
}
