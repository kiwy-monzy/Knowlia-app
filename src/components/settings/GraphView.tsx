"use client";

import { FC, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Wifi, Globe, Bluetooth, User, Network } from 'lucide-react';

// Dynamically import ForceGraph2D from the dedicated 2D package
// This avoids the A-Frame dependency issues
const ForceGraph2D = dynamic(
    () => import('react-force-graph-2d'), 
    {
        ssr: false,
        loading: () => <div className="flex justify-center items-center h-96 text-gray-300">Loading network graph...</div>
    }
);

interface NetworkUser {
    peer_id: string;
    q8id: string;
    name: string;
    is_online: boolean;
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

const GraphView: FC = () => {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<NetworkUser | null>(null);

    // Fetch network users from Tauri backend
    const fetchNetworkUsers = useCallback(async () => {
        try {
            setLoading(true);
            const usersJson = await invoke<string>('get_all_users');
            const users: NetworkUser[] = JSON.parse(usersJson);
            setNetworkUsers(users);
            console.log('Fetched network users:', users);
        } catch (error) {
            console.error('Failed to fetch network users:', error);
            setNetworkUsers([]);
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
                unlisten = await listen<NetworkUser[]>('neighbors-updated', (event) => {
                    console.log('Received neighbors-updated event:', event.payload);
                    
                    let parsedPayload = event.payload;
                    if (typeof event.payload === 'string') {
                        try {
                            parsedPayload = JSON.parse(event.payload);
                        } catch (error) {
                            console.error('Failed to parse event payload:', error);
                            return;
                        }
                    }
                    
                    setNetworkUsers(parsedPayload);
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
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const relayNodes = new Set<string>();
        
        // First pass: collect all unique node IDs and create user nodes
        networkUsers.forEach((user) => {
            // Add user node
            const userColor = user.is_online ? getNodeColorForUser(user) : '#9ca3af';
            
            nodes.push({
                id: user.peer_id,
                name: user.name || 'Unknown User',
                peer_id: user.peer_id,
                q8id: user.q8id,
                is_online: user.is_online,
                is_relay: false,
                connections: user.connections.map(c => c.module),
                val: 1 + (user.connections.length * 0.3), // Size based on connections
                color: userColor
            });
            
            // Collect relay nodes from connections
            user.connections.forEach(conn => {
                if (conn.via_node) {
                    relayNodes.add(conn.via_node);
                }
            });
        });
        
        // Second pass: create relay nodes
        relayNodes.forEach(relayId => {
            nodes.push({
                id: relayId,
                name: 'Relay Node',
                peer_id: relayId,
                q8id: '',
                is_online: true,
                is_relay: true,
                connections: [],
                val: 0.5, // Smaller size for relay nodes
                color: '#6b7280'
            });
        });
        
        // Third pass: create links
        networkUsers.forEach((user) => {
            user.connections.forEach((connection) => {
                if (connection.via_node) {
                    const linkColor = getLinkColor(connection.module);
                    links.push({
                        source: user.peer_id,
                        target: connection.via_node,
                        color: linkColor,
                        module: connection.module,
                        animated: user.is_online
                    });
                }
            });
        });
        
        console.log(`Created graph with ${nodes.length} nodes and ${links.length} links`);
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
                <ClientOnly>
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
                        backgroundColor={getBackgroundColor}
                        linkDirectionalArrowLength={3.5}
                        linkDirectionalArrowRelPos={1}
                        cooldownTicks={100}
                        onNodeClick={handleNodeClick}
                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                            // Draw the node circle
                            const label = node.name;
                            const fontSize = node.is_relay ? 8/globalScale : 11/globalScale;
                            const nodeSize = Math.max(3, (node.val || 1) * 6);
                            
                            // Draw the circle for the node
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                            ctx.fillStyle = node.color;
                            ctx.fill();
                            
                            // Add border for online users
                            if (node.is_online && !node.is_relay) {
                                ctx.strokeStyle = '#ffffff';
                                ctx.lineWidth = 2;
                                ctx.stroke();
                            }
                            
                            // Draw the text label
                            ctx.font = `${fontSize}px Sans-Serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#ffffff';
                            
                            // Add a small shadow for better readability
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 1;
                            ctx.shadowOffsetY = 1;
                            
                            // Position the text below the node
                            const textY = node.y + nodeSize + fontSize + 2;
                            ctx.fillText(label, node.x, textY);
                            
                            // Draw connection type icons for users
                            if (!node.is_relay && node.connections.length > 0) {
                                const iconSize = 8;
                                const iconY = textY + fontSize + 4;
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
                            const nodeSize = Math.max(3, (node.val || 1) * 6);
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, nodeSize + 12, 0, 2 * Math.PI);
                            ctx.fillStyle = color;
                            ctx.fill();
                        }}
                    />
                </ClientOnly>
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