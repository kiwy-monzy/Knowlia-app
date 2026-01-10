"use client";

import { FC, useEffect, useState, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Wifi, Globe, Bluetooth, User, Network } from 'lucide-react';

// ==================== DEBOUNCE UTILITY ====================
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Dynamically import ForceGraph2D using React.lazy
const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

interface NetworkUser {
    peer_id: string;
    q8id: string;
    name: string;
    is_online: boolean;
    is_relay?: boolean;
    connections: Array<{
        module: number;
        via_node?: string;
        hop_count: number;
        rtt: number;
    }>;
    base?: {
        id: string;
        key_base58: string;
        verified: boolean;
        blocked: boolean;
        profile?: string;
        about?: string;
        college?: string;
    };
}

interface GraphNode {
    id: string;
    name: string;
    peer_id: string;
    q8id: string;
    is_online: boolean;
    is_relay: boolean;
    connections: number[];
    val: number; // Size of the node
    color: string;
    module?: number;
}

interface GraphLink {
    source: string;
    target: string;
    color: string;
    module: number;
    animated?: boolean;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

// ClientOnly is a utility component to only render children on the client
const ClientOnly: FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasMounted, setHasMounted] = useState(false);
    
    useEffect(() => {
        setHasMounted(true);
    }, []);
    
    if (!hasMounted) {
        return <div className="flex justify-center items-center h-96 text-gray-300">Loading graph view...</div>;
    }
    
    return <>{children}</>;
};

// Mock network data for demonstration
const mockNetworkUsers: NetworkUser[] = [
  {
    peer_id: 'user-1',
    q8id: 'q8id-1',
    name: 'Alice Johnson',
    is_online: true,
    connections: [
      { module: 2, rtt: 45, hop_count: 1, via_node: 'relay-1' },
      { module: 1, rtt: 30, hop_count: 1 }
    ]
  },
  {
    peer_id: 'user-2',
    q8id: 'q8id-2',
    name: 'Bob Smith',
    is_online: true,
    connections: [
      { module: 2, rtt: 65, hop_count: 1, via_node: 'relay-1' },
      { module: 1, rtt: 25, hop_count: 1 }
    ]
  },
  {
    peer_id: 'user-3',
    q8id: 'q8id-3',
    name: 'Carol Davis',
    is_online: true,
    connections: [
      { module: 2, rtt: 80, hop_count: 1, via_node: 'relay-1' },
      { module: 4, rtt: 120, hop_count: 1 }
    ]
  },
  {
    peer_id: 'user-4',
    q8id: 'q8id-4',
    name: 'David Wilson',
    is_online: true,
    connections: [
      { module: 1, rtt: 15, hop_count: 1 }
    ]
  },
  {
    peer_id: 'user-5',
    q8id: 'q8id-5',
    name: 'Emma Brown',
    is_online: false,
    connections: [
      { module: 2, rtt: 200, hop_count: 2, via_node: 'relay-2' }
    ]
  },
  {
    peer_id: 'relay-1',
    q8id: '',
    name: 'Relay Node 1',
    is_online: true,
    connections: [],
    is_relay: true
  },
  {
    peer_id: 'relay-2',
    q8id: '',
    name: 'Relay Node 2',
    is_online: true,
    connections: [],
    is_relay: true
  }
];

const GraphView: FC = () => {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>(mockNetworkUsers);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<NetworkUser | null>(null);

    // Fetch network users from Tauri backend
    const fetchNetworkUsers = useCallback(async () => {
        try {
            setLoading(true);
            const usersJson = await invoke<string>('get_all_users');
            let users: NetworkUser[];
            try {
                users = JSON.parse(usersJson);
            } catch (parseError) {
                users = [];
            }
            
            setNetworkUsers(users);
        } catch (error) {
            console.error('Failed to fetch network users:', error);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth > 1200 ? 1000 : window.innerWidth - 100,
                height: 600
            });
        };

        handleResize(); // Set initial dimensions
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);
    
    // Fetch users on component mount and set up event listener
    useEffect(() => {
        fetchNetworkUsers();
        
        // Set up event listener for real-time updates
        let unlisten: (() => void) | null = null;
        
        const setupEventListener = async () => {
            try {
                // Debounced update function to prevent excessive re-renders
                const debouncedUpdate = debounce((payload: NetworkUser[]) => {
                    setNetworkUsers(payload);
                }, 300); // 300ms debounce delay

                unlisten = await listen<NetworkUser[]>('neighbors-updated', (event) => {
                    
                    let parsedPayload = event.payload;
                    if (typeof event.payload === 'string') {
                        try {
                            parsedPayload = JSON.parse(event.payload);
                        } catch (error) {
                            console.error('Failed to parse event payload:', error);
                            return;
                        }
                    }
                    
                    debouncedUpdate(parsedPayload);
                });
            } catch (error) {
                console.error('Failed to setup event listener:', error);
            }
        };
        
        setupEventListener();
        
        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [fetchNetworkUsers]);

    // Transform network users into graph format
    useEffect(() => {
        console.log('Transforming network users to graph format...');
        console.log('Current networkUsers:', networkUsers);
        
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const relayNodes = new Set<string>();
        
        if (networkUsers.length === 0) {
            console.log('No network users to transform');
            setGraphData({ nodes: [], links: [] });
            return;
        }
        
        // First pass: collect all unique node IDs and create user nodes
        networkUsers.forEach((user, userIndex) => {
            console.log(`Processing user ${userIndex + 1}/${networkUsers.length}:`, user.name, 'online:', user.is_online);
            
            // Add user node
            const userColor = user.is_online ? getNodeColorForUser(user) : '#9ca3af';
            
            const graphNode: GraphNode = {
                id: user.peer_id,
                name: user.name || 'Unknown User',
                peer_id: user.peer_id,
                q8id: user.q8id,
                is_online: user.is_online,
                is_relay: false,
                connections: user.connections.map(c => c.module),
                val: 1 + (user.connections.length * 0.3), // Size based on connections
                color: userColor
            };
            
            console.log('Created graph node:', graphNode);
            nodes.push(graphNode);
            
            // Collect relay nodes from connections
            user.connections.forEach(conn => {
                if (conn.via_node) {
                    relayNodes.add(conn.via_node);
                    console.log('Found relay node:', conn.via_node);
                }
            });
        });
        
        console.log('Relay nodes found:', Array.from(relayNodes));
        
        // Second pass: create relay nodes
        relayNodes.forEach(relayId => {
            const relayNode: GraphNode = {
                id: relayId,
                name: 'Relay Node',
                peer_id: relayId,
                q8id: '',
                is_online: true,
                is_relay: true,
                connections: [],
                val: 0.5, // Smaller size for relay nodes
                color: '#6b7280'
            };
            nodes.push(relayNode);
        });
        
        // Third pass: create links
        networkUsers.forEach((user) => {
            user.connections.forEach((connection) => {
                if (connection.via_node) {
                    const linkColor = getLinkColor(connection.module);
                    const link: GraphLink = {
                        source: user.peer_id,
                        target: connection.via_node,
                        color: linkColor,
                        module: connection.module,
                        animated: user.is_online
                    };
                    links.push(link);
                    console.log('Created link:', link);
                }
            });
        });
        
        console.log(`Final graph data: ${nodes.length} nodes and ${links.length} links`);
        console.log('Nodes:', nodes);
        console.log('Links:', links);
        
        setGraphData({ nodes, links });
    }, [networkUsers]);

    // Handle node click to select a user
    const handleNodeClick = useCallback((node: any) => {
        if (!node.is_relay) {
            const user = networkUsers.find(u => u.peer_id === node.id);
            if (user) {
                setSelectedUser(user);
                console.log('Selected user:', user);
            }
        }
    }, [networkUsers]);

    // Get color for user based on connection types
    const getNodeColorForUser = (user: NetworkUser): string => {
        if (!user.is_online) return '#9ca3af'; // gray-500 for offline
        
        const connectionTypes = new Set(user.connections.map(c => c.module));
        
        if (connectionTypes.has(2) && connectionTypes.has(1) && connectionTypes.has(4)) {
            return '#8b5cf6'; // purple-500 for multi-connection
        } else if (connectionTypes.has(2) && connectionTypes.has(1)) {
            return '#06b6d4'; // cyan-500 for internet + lan
        } else if (connectionTypes.has(2) && connectionTypes.has(4)) {
            return '#f59e0b'; // amber-500 for internet + ble
        } else if (connectionTypes.has(1) && connectionTypes.has(4)) {
            return '#10b981'; // green-500 for lan + ble
        } else if (connectionTypes.has(2)) {
            return '#3b82f6'; // blue-500 for internet only
        } else if (connectionTypes.has(1)) {
            return '#10b981'; // green-500 for lan only
        } else if (connectionTypes.has(4)) {
            return '#f97316'; // orange-500 for ble only
        }
        
        return '#6b7280'; // gray-600 default
    };
    
    // Get link color based on connection module
    const getLinkColor = (module: number): string => {
        switch (module) {
            case 2: return '#3b82f6'; // blue-500 for internet
            case 1: return '#10b981'; // green-500 for lan
            case 4: return '#f97316'; // orange-500 for ble
            default: return '#94a3b8'; // gray-400 default
        }
    };

    // Get background color for the canvas
    const getBackgroundColor = () => {
        return '#111827'; // gray-900 for dark mode background
    };

    return (
        <div className="bg-gray-900 rounded-lg shadow-xl border border-gray-700 p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Network Graph</h2>
                    <p className="text-gray-400 text-sm">Real-time network topology with users and connections</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-xs text-gray-300">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Internet</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-300">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>LAN</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-300">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>BLE</span>
                    </div>
                    <button
                        onClick={fetchNetworkUsers}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    >
                        Refresh
                    </button>
                    <button
                        onClick={() => console.log('Current state:', { networkUsers, graphData, loading })}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
                    >
                        Debug
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                console.log('Manually triggering network update...');
                                await invoke('trigger_network_users_update');
                                console.log('Network update triggered successfully');
                            } catch (error) {
                                console.error('Failed to trigger network update:', error);
                            }
                        }}
                        className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm"
                    >
                        Trigger Update
                    </button>
                </div>
            </div>
            
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                </div>
            ) : graphData.nodes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Network className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <p>No network users found</p>
                    <p className="text-sm mt-2">Try connecting to other qaul nodes</p>
                </div>
            ) : (
                <Suspense fallback={<div className="flex justify-center items-center h-96 text-gray-300">Loading network graph...</div>}>
                    <ForceGraph2D
                        width={dimensions.width}
                        height={dimensions.height}
                        graphData={graphData}
                        nodeLabel={(node: any) => {
                            const labels = [];
                            if (node.name && node.name !== 'Relay Node') labels.push(node.name);
                            if (node.peer_id) labels.push(`Peer: ${node.peer_id.substring(0, 8)}...`);
                            if (node.q8id) labels.push(`Q8ID: ${node.q8id.substring(0, 8)}...`);
                            if (!node.is_online) labels.push('(Offline)');
                            return labels.join(' - ');
                        }}
                        nodeColor={(node: any) => node.color}
                        linkColor={(link: any) => link.color}
                        backgroundColor={getBackgroundColor()}
                        linkDirectionalArrowLength={3.5}
                        linkDirectionalArrowRelPos={1}
                        cooldownTicks={100}
                        onNodeClick={handleNodeClick}
                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            // Draw the node circle
                            const label = node.name;
                            const fontSize = node.is_relay ? 10/globalScale : 12/globalScale;
                            const nodeSize = Math.max(4, (node.val || 1) * 8); // Increased base size
                            
                            // Draw circle for the node
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                            ctx.fillStyle = node.color;
                            ctx.fill();
                            
                            // Add border for online users
                            if (node.is_online && !node.is_relay) {
                                ctx.strokeStyle = '#ffffff';
                                ctx.lineWidth = 3; // Thicker border
                                ctx.stroke();
                            }
                            
                            // Draw the text label
                            ctx.font = `bold ${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#ffffff';
                            
                            // Add a stronger shadow for better readability
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                            ctx.shadowBlur = 6;
                            ctx.shadowOffsetX = 2;
                            ctx.shadowOffsetY = 2;
                            
                            // Position text below the node
                            const textY = node.y + nodeSize + fontSize + 4;
                            ctx.fillText(label, node.x, textY);
                            
                            // Draw connection type icons for users
                            if (!node.is_relay && node.connections.length > 0) {
                                const iconSize = 10;
                                const iconY = textY + fontSize + 6;
                                let iconX = node.x - (node.connections.length * iconSize) / 2;
                                
                                node.connections.forEach((module: number) => {
                                    ctx.fillStyle = getLinkColor(module);
                                    if (module === 2) {
                                        // Internet icon (circle)
                                        ctx.beginPath();
                                        ctx.arc(iconX, iconY, iconSize/2, 0, 2 * Math.PI);
                                        ctx.fill();
                                    } else if (module === 1) {
                                        // LAN icon (square)
                                        ctx.fillRect(iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize);
                                    } else if (module === 4) {
                                        // BLE icon (triangle)
                                        ctx.beginPath();
                                        ctx.moveTo(iconX, iconY - iconSize/2);
                                        ctx.lineTo(iconX - iconSize/2, iconY + iconSize/2);
                                        ctx.lineTo(iconX + iconSize/2, iconY + iconSize/2);
                                        ctx.closePath();
                                        ctx.fill();
                                    }
                                    iconX += iconSize + 2;
                                });
                            }
                            
                            // Reset shadow effect
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                        }}
                        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                            // Increase the pointer area to include the label
                            const nodeSize = Math.max(4, (node.val || 1) * 8);
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, nodeSize + 15, 0, 2 * Math.PI); // Larger hit area
                            ctx.fillStyle = color;
                            ctx.fill();
                        }}
                    />
                </Suspense>
            )}
            
            {/* Selected User Details */}
            {selectedUser && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                            <User className="w-5 h-5 text-blue-400" />
                            <span>User Details</span>
                        </h3>
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400">Name</p>
                            <p className="text-white font-medium">{selectedUser.name || 'Unknown User'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Status</p>
                            <p className="text-white font-medium">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                    selectedUser.is_online ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full mr-1 ${
                                        selectedUser.is_online ? 'bg-green-400' : 'bg-red-400'
                                    }`}></span>
                                    {selectedUser.is_online ? 'Online' : 'Offline'}
                                </span>
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400">Peer ID</p>
                            <p className="text-white font-mono text-xs">{selectedUser.peer_id}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Q8 ID</p>
                            <p className="text-white font-mono text-xs">{selectedUser.q8id}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-gray-400 mb-2">Connections ({selectedUser.connections.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser.connections.map((conn, index) => (
                                    <span key={index} className={`inline-flex items-center px-2 py-1 rounded text-xs border ${
                                        conn.module === 2 ? 'bg-blue-500/20 text-blue-400 border-blue-400' :
                                        conn.module === 1 ? 'bg-green-500/20 text-green-400 border-green-400' :
                                        'bg-orange-500/20 text-orange-400 border-orange-400'
                                    }`}>
                                        {conn.module === 2 && <Globe className="w-3 h-3 mr-1" />}
                                        {conn.module === 1 && <Wifi className="w-3 h-3 mr-1" />}
                                        {conn.module === 4 && <Bluetooth className="w-3 h-3 mr-1" />}
                                        {conn.module === 2 ? 'Internet' : conn.module === 1 ? 'LAN' : 'BLE'}
                                        {conn.rtt > 0 && ` (${(conn.rtt / 1000).toFixed(1)}ms)`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GraphView; 