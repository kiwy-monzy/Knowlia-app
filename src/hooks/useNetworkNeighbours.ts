import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface InternetNeighbourInfo {
  peer_id: number[];
  address: string;
  name: string;
  online: boolean;
  rtt_ms: number | null;
}

export const useNetworkNeighbours = () => {
  const [internetNeighbours, setInternetNeighbours] = useState<InternetNeighbourInfo[]>([]);

  const fetchInternetNeighbours = async () => {
    try {
      const neighbours = await invoke<InternetNeighbourInfo[]>('get_internet_neighbours_ui_command');
      setInternetNeighbours(neighbours);
    } catch (error) {
      console.error('Failed to fetch internet neighbours:', error);
    }
  };

  useEffect(() => {
    fetchInternetNeighbours();
    
    const interval = setInterval(fetchInternetNeighbours, 2000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    internetNeighbours,
    fetchInternetNeighbours
  };
};
