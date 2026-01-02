import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Activity, Users, Globe, Bluetooth } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Network node interface
interface NetworkNode {
  id: string;
  name: string;
  address: string;
  online: boolean;
  rttMs?: number;  // Round-trip time in milliseconds
  connectionType: 'internet' | 'lan' | 'ble' | 'local';
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

// API Response interfaces
interface RawNode {
  node_id: number[];
  user_name?: string;
  name?: string;
  address?: string;
  online?: boolean;
  rtt?: number;
  connection_type?: string;
}

interface NeighboursResponse {
  internet: RawNode[];
  lan: RawNode[];
  ble: RawNode[];
  total_count: number;
}

// Network visualization component with force-directed layout
function NetworkGraph({ nodes }: { nodes: NetworkNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const [localName, setLocalName] = useState('YOU');

  const localNode: NetworkNode = { 
    id: 'local', 
    name: localName, 
    address: '',
    online: true,
    connectionType: 'local',
    x: 400, 
    y: 300, 
  };

  // Fetch local user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileStr = await invoke('user_profile');
        const profile = JSON.parse(profileStr as string);
        if (profile.name) {
          setLocalName(profile.name);
        }
      } catch (err) {
        console.error('Failed to fetch local profile:', err);
      }
    };
    fetchProfile();
  }, []);

  // Initialize node positions
  useEffect(() => {
    let needsUpdate = false;
    const newPositions = new Map(positionsRef.current);
    const existingIds = new Set(Array.from(positionsRef.current.keys()));
    
    // Remove nodes that no longer exist
    existingIds.forEach(id => {
      if (!nodes.some(n => n.id === id)) {
        newPositions.delete(id);
        needsUpdate = true;
      }
    });

    // Add new nodes with positions
    nodes.forEach(node => {
      if (!newPositions.has(node.id)) {
        // Position new nodes in a circle around the center
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 150;
        newPositions.set(node.id, {
          x: localNode.x! + Math.cos(angle) * radius,
          y: localNode.y! + Math.sin(angle) * radius,
          vx: 0,
          vy: 0
        });
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      positionsRef.current = newPositions;
    }
  }, [nodes]);

  // Physics simulation and rendering
  useEffect(() => {
    if (nodes.length === 0) {
      // Clear canvas if no nodes
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = 0;
    const frameRate = 60; // Target 60 FPS
    const frameInterval = 1000 / frameRate;

    const animate = (timestamp: number) => {
      // Throttle frame rate
      const deltaTime = timestamp - lastTime;
      if (deltaTime < frameInterval) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastTime = timestamp - (deltaTime % frameInterval);

      // Clear canvas
      ctx.clearRect(0, 0, 800, 600);

      const currentPositions = positionsRef.current;
      const newPositions = new Map(currentPositions);
      
      // Apply forces
      nodes.forEach((node1, i) => {
        const pos1 = newPositions.get(node1.id);
        if (!pos1) return;

        // Repulsion from other nodes
        nodes.forEach((node2, j) => {
          if (i === j) return;
          const pos2 = newPositions.get(node2.id);
          if (!pos2) return;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (distance < 100) {
            const force = 500 / (distance * distance);
            pos1.vx -= (dx / distance) * force;
            pos1.vy -= (dy / distance) * force;
          }
        });

        // Attraction to center (local node)
        const dxCenter = localNode.x! - pos1.x;
        const dyCenter = localNode.y! - pos1.y;
        const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) || 1;
        const targetDist = 150;
        const springForce = (distCenter - targetDist) * 0.01;
        
        pos1.vx += (dxCenter / distCenter) * springForce;
        pos1.vy += (dyCenter / distCenter) * springForce;

        // Apply velocity with damping and smooth movement
        pos1.vx *= 0.85;
        pos1.vy *= 0.85;
        
        // Apply smooth movement with easing
        const dx = (pos1.x + pos1.vx) - pos1.x;
        const dy = (pos1.y + pos1.vy) - pos1.y;
        pos1.x += dx * 0.2; // Adjust the multiplier for more/less smoothness
        pos1.y += dy * 0.2;

        // Boundary constraints
        const margin = 50;
        if (pos1.x < margin) { pos1.x = margin; pos1.vx = 0; }
        if (pos1.x > 800 - margin) { pos1.x = 800 - margin; pos1.vx = 0; }
        if (pos1.y < margin) { pos1.y = margin; pos1.vy = 0; }
        if (pos1.y > 600 - margin) { pos1.y = 600 - margin; pos1.vy = 0; }
      });

      // Update the ref with new positions
      positionsRef.current = newPositions;

      // Draw connections with ping times
      nodes.forEach(node => {
        const pos = newPositions.get(node.id);
        if (!pos) return;
        
        // Calculate midpoint for the ping text
        const midX = (localNode.x! + pos.x) / 2;
        const midY = (localNode.y! + pos.y) / 2;
        
        // Draw connection line
        ctx.beginPath();
        ctx.moveTo(localNode.x!, localNode.y!);
        ctx.lineTo(pos.x, pos.y);
        
        if (node.online) {
          ctx.strokeStyle = node.connectionType === 'internet' ? 'rgba(59, 130, 246, 0.4)' :
                           node.connectionType === 'lan' ? 'rgba(16, 185, 129, 0.4)' :
                           node.connectionType === 'ble' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(156, 163, 175, 0.3)';
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
          ctx.setLineDash([5, 5]);
        }
        
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Draw ping time if available
        if (node.rttMs !== undefined && node.online) {
          const pingText = node.rttMs < 10 && node.rttMs > 0 ? `${node.rttMs.toFixed(1)}ms` : `${Math.round(node.rttMs)}ms`;
          const textWidth = ctx.measureText(pingText).width;
          const padding = 6;
          const radius = 8;
          
          // Draw background for better readability
          ctx.beginPath();
          ctx.roundRect(
            midX - textWidth/2 - padding, 
            midY - 10, 
            textWidth + padding * 2, 
            16, 
            radius
          );
          
          // Style based on connection type
          if (node.connectionType === 'internet') {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
          } else if (node.connectionType === 'lan') {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
          } else if (node.connectionType === 'ble') {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
          } else {
            ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
          }
          
          ctx.fill();
          
          // Draw ping text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pingText, midX, midY + 1);
        }
      });

      // Draw local node
      ctx.beginPath();
      ctx.arc(localNode.x!, localNode.y!, 35, 0, Math.PI * 2);
      ctx.fillStyle = '#8b5cf6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(localNode.name.length > 5 ? localNode.name.substring(0, 4) + '..' : localNode.name.toUpperCase(), localNode.x!, localNode.y!);

      // Draw network nodes
      nodes.forEach(node => {
        const pos = newPositions.get(node.id);
        if (!pos) return;

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
        
        if (node.online) {
          ctx.fillStyle = node.connectionType === 'internet' ? '#3b82f6' :
                          node.connectionType === 'lan' ? '#10b981' :
                          node.connectionType === 'ble' ? '#f59e0b' : '#6b7280';
        } else {
          ctx.fillStyle = '#6b7280';
        }
        
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Node label - show first letter as initial in the center
        const isAnonymous = node.name.startsWith('Node-');
        const initial = isAnonymous ? '?' : node.name.charAt(0).toUpperCase();
        ctx.fillStyle = '#ffffff';
        ctx.font = isAnonymous ? 'bold 18px sans-serif' : 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, pos.x, pos.y);
        
        // Name below node - ensure it's not too long
        const maxWidth = 100; // Increased max width
        let displayName = node.name;
        
        ctx.font = 'bold 12px sans-serif'; // Larger, bolder font
        const textMetrics = ctx.measureText(displayName);
        
        // Truncate long names with ellipsis
        if (textMetrics.width > maxWidth) {
          while (displayName.length > 3 && ctx.measureText(displayName + '...').width > maxWidth) {
            displayName = displayName.substring(0, displayName.length - 1);
          }
          displayName += '...';
        }
        
        ctx.fillStyle = '#1f2937'; // Darker for better contrast
        ctx.textAlign = 'center';
        ctx.fillText(displayName, pos.x, pos.y + 44);
        
        // Connection type badge
        ctx.font = 'italic 10px sans-serif';
        ctx.fillStyle = '#6b7280';
        const typeLabel = node.connectionType.toUpperCase();
        ctx.fillText(typeLabel, pos.x, pos.y + 58);
      });

      // Schedule next frame with the callback that includes timestamp
      animationId = requestAnimationFrame(animate);
    };

    // Start animation with timestamp
    animationId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [nodes]); // Only re-run if nodes change

  return (
    <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
      <canvas 
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-auto"
      />
    </div>
  );
}

export default function NetworkSettings() {
  const [neighbors, setNeighbors] = useState<NetworkNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert Uint8Array (or number[]) to hex string
  const bytesToHex = (bytes: number[] | Uint8Array): string => 
    Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');

  const fetchNeighbors = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await invoke('get_all_neighbours');
      const parsed: NeighboursResponse = raw as NeighboursResponse;
      
      setNeighbors(prevNeighbors => {
        // Create a map of existing nodes for quick lookup
        const existingNodes = new Map(prevNeighbors.map(n => [n.id, n]));
        const newNeighbors: NetworkNode[] = [];
        let hasChanges = false;

        // Process each category of neighbors
        ['internet', 'lan', 'ble'].forEach((key) => {
          const list = parsed[key as keyof Omit<NeighboursResponse, 'total_count'>] as RawNode[] | undefined;
          if (!list) return;
          
          list.forEach((n) => {
            const nodeId = bytesToHex(n.node_id ?? []);
            const existingNode = existingNodes.get(nodeId);
            const nodeName = n.user_name || n.name || 'Unknown';
            const isNewNode = !existingNode;
            const nodeChanged = isNewNode || 
              existingNode?.name !== nodeName || 
              existingNode?.online !== (n.online ?? true) ||
              existingNode?.rttMs !== n.rtt;

            if (isNewNode || nodeChanged) {
              hasChanges = true;
              
              // Calculate position for new nodes
              let x, y;
              if (key === 'internet') {
                // Position internet nodes at the top center
                const internetNodes = newNeighbors.filter(n => n.connectionType === 'internet');
                const angle = (internetNodes.length / 5) * Math.PI * 2;
                x = 400 + Math.cos(angle) * 100;
                y = 150 + Math.sin(angle) * 30;
              } else if (key === 'lan') {
                // Position LAN nodes in a circle around the center
                const lanNodes = newNeighbors.filter(n => n.connectionType === 'lan');
                const angle = (lanNodes.length / 5) * Math.PI * 2;
                x = 400 + Math.cos(angle) * 200;
                y = 300 + Math.sin(angle) * 150;
              } else {
                // Position BLE nodes in an outer circle
                const bleNodes = newNeighbors.filter(n => n.connectionType === 'ble');
                const angle = (bleNodes.length / 5) * Math.PI * 2;
                x = 400 + Math.cos(angle) * 250;
                y = 300 + Math.sin(angle) * 200;
              }

              newNeighbors.push({
                id: nodeId,
                name: nodeName,
                address: n.address || '',
                online: n.online !== undefined ? n.online : true,
                rttMs: n.rtt,
                connectionType: (n.connection_type || key) as 'internet' | 'lan' | 'ble',
                x: existingNode?.x ?? x,
                y: existingNode?.y ?? y,
                vx: existingNode?.vx ?? 0,
                vy: existingNode?.vy ?? 0
              });
            } else {
              // Keep existing node with its current position
              newNeighbors.push(existingNode);
            }
          });
        });

        return hasChanges ? newNeighbors : prevNeighbors;
      });
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch neighbors:', err);
      setError('Failed to load network information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchNeighbors();
    
    // Listen for background updates
    const unlisten = listen('neighbors-updated', fetchNeighbors);
    
    // Cleanup
    return () => {
      unlisten.then(f => f());
    };
  }, [fetchNeighbors]);

  const getStats = () => {
    const totalCount = neighbors.length;
    const internetCount = neighbors.filter(n => n.connectionType === 'internet').length;
    const lanCount = neighbors.filter(n => n.connectionType === 'lan').length;
    const bleCount = neighbors.filter(n => n.connectionType === 'ble').length;
    
    return { totalCount, internetCount, lanCount, bleCount };
  };


  return (
    <div className="p-6 pb-18 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Network Monitor</h2>
          <p className="text-gray-600 mt-1">Real-time qaul network topology and connections</p>
        </div>
        <div className="flex items-center space-x-3 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
          <Activity className="w-5 h-5 text-green-600 animate-pulse" />
          <span className="text-sm font-semibold text-green-700">
            {neighbors.length > 0 ? 'Network Active' : 'No Connections'}
          </span>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="bg-white  p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Internet</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">LAN</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-gray-600">Bluetooth</span>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-red-600">{error}</p>
          </div>
        ) : neighbors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <WifiOff className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">No network connections found</p>
            <p className="text-sm text-gray-500 mt-1">Try connecting to other qaul nodes</p>
          </div>
        ) : (
          <NetworkGraph nodes={neighbors} />
        )}
      </div>


    </div>
  );
}