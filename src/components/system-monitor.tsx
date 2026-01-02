"use client"
import { useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card } from "./ui/card"
import { Users, Activity, Wifi } from 'lucide-react'
import { useSite } from '@/contexts/SiteContext';
import { invoke } from '@tauri-apps/api/core';
import { MeshGradient } from "@paper-design/shaders-react";
import TSLAGraph from "./TSLAGraph";

interface InternetNeighbourInfo {
  peer_id: number[];
  address: string;
  name: string;
  online: boolean;
  rtt_ms: number | null;
}

interface SystemMonitorProps {
  compact?: boolean;
}

export default function SystemMonitor({ compact }: SystemMonitorProps) {
  const { networkStats: stats } = useSite();
  const [internetNeighbours, setInternetNeighbours] = useState<InternetNeighbourInfo[]>([]);

  const latency = stats && typeof stats.latency_ms === 'number' ? stats.latency_ms : undefined;
  const isOnline = stats?.is_online ?? true;

  // Fetch internet neighbours data
  useEffect(() => {
    const fetchInternetNeighbours = async () => {
      try {
        const neighbours = await invoke<InternetNeighbourInfo[]>('get_internet_neighbours_ui_command');
        setInternetNeighbours(neighbours);
      } catch (error) {
        console.error('Failed to fetch internet neighbours:', error);
      }
    };

    fetchInternetNeighbours();
    
    // Refresh every 2 seconds
    const interval = setInterval(fetchInternetNeighbours, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const gatewayName = stats?.gateway_name || 'Internet gateway';
  const gatewayAddr = stats?.gateway_addr;
  const gatewayLatency = stats && typeof stats.gateway_latency_ms === 'number' ? stats.gateway_latency_ms : undefined;
  const gatewayOnline = stats?.gateway_online ?? isOnline;

  const latencyColor = useMemo(() => {
    if (typeof latency !== 'number') return 'text-gray-400';
    if (latency < 80) return 'text-emerald-500';
    if (latency < 200) return 'text-amber-500';
    return 'text-red-500';
  }, [latency]);

  // Generate time series data for TSLAGraph
  const generateTimeSeriesData = (neighbours: InternetNeighbourInfo[]) => {
    const onlineCount = neighbours.filter(n => n.online).length;
    const now = new Date();
    
    // Generate mock data for the last 30 days
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate realistic-looking data with some variation
      const baseConnections = Math.max(onlineCount, 20);
      const connections = baseConnections + Math.floor(Math.random() * 20) - 10;
      const tsli = 95 + Math.random() * 4.5; // TSLA between 95-99.5%
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        connections: Math.max(0, connections),
        tsli: parseFloat(tsli.toFixed(1))
      });
    }
    
    return data;
  };

  if (compact) {
    // Compact header pill: show internet neighbours count
    const onlineCount = internetNeighbours.filter(n => n.online).length;
    const avgLatency = internetNeighbours
      .filter(n => n.online && n.rtt_ms)
      .reduce((sum, n) => sum + n.rtt_ms!, 0) / onlineCount || undefined;
    
    return (
      <div
        className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-md sidebar-3d-icon border border-black/50 ${
          onlineCount > 0 && (!avgLatency || avgLatency < 200) ? 'bg-emerald-900' : 'bg-red-900'
        } text-white`}
      >
        <Users className="w-3 h-3" />
        <span className="truncate max-w-[86px]">
          {onlineCount} neighbour{onlineCount !== 1 ? 's' : ''}
        </span>
        {typeof avgLatency === 'number' && (
          <span className={
            avgLatency < 80 ? 'text-emerald-500' :
            avgLatency < 200 ? 'text-amber-500' : 'text-red-500'
          }>
            {Math.round(avgLatency)}ms
          </span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="flex items-center justify-center min-h-screen"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="relative overflow-hidden w-[420px] bg-background/95 backdrop-blur-sm border border-border shadow-lg p-4 space-y-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <MeshGradient
            speed={0.5}
            colors={["#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0"]}
            distortion={0.4}
            swirl={0.05}
            grainMixer={0}
            grainOverlay={0}
            className="inset-0 sticky top-0"
            style={{ height: "100%", width: "100%" }}
          />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Internet Neighbours</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {internetNeighbours.length} connected
            </span>
          </div>

          {/* Internet neighbours list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {internetNeighbours.length === 0 ? (
              <div className="rounded-md border border-border p-3 text-center">
                <Wifi className="w-3 h-3 text-gray-400 mx-auto mb-1" />
                <div className="text-xs text-muted-foreground">
                  No internet neighbours currently connected
                </div>
              </div>
            ) : (
              internetNeighbours.map((neighbour, index) => (
                <div key={index} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className={`w-3 h-3 ${neighbour.online ? 'text-sky-400' : 'text-gray-400'}`} />
                      <span className="text-xs font-semibold">{neighbour.name}</span>
                    </div>
                    <div className="text-xs flex items-center gap-1">
                      <span className={neighbour.online ? 'text-emerald-500' : 'text-red-500'}>
                        {neighbour.online ? 'Online' : 'Offline'}
                      </span>
                      {neighbour.rtt_ms && (
                        <span className={
                          neighbour.rtt_ms < 80 ? 'text-emerald-500' :
                          neighbour.rtt_ms < 200 ? 'text-amber-500' : 'text-red-500'
                        }>
                          {neighbour.rtt_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {neighbour.address !== 'Unknown' ? neighbour.address : 'Unknown address'}
                    {neighbour.address !== 'Unknown' && neighbour.address.length > 30 && (
                      <span className="opacity-70">
                        {' · '}{neighbour.address.substring(0, 30)}...
                      </span>
                    )}
                  </div>
                  {neighbour.online && !neighbour.rtt_ms && (
                    <div className="text-[11px] text-blue-600 mt-1">
                      Connected · measuring latency...
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* TSLA Performance Graph */}
        <div className="mt-6">
          <TSLAGraph data={generateTimeSeriesData(internetNeighbours)} />
        </div>
      </Card>
    </motion.div>
  )
}
