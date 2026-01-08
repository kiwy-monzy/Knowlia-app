import React from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Wifi,
  WifiOff,
  Globe,
  Bluetooth,
  Network,
  UserCheck,
  X,
} from 'lucide-react';

// ==================== TYPES ====================

export interface UserConnection {
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
}

export interface NetworkSettingsProps {
  users?: UserConnection[];
  loading?: boolean;
  error?: string | null;
  onUserClick?: (user: UserConnection) => void;
}

// ==================== HELPER FUNCTIONS ====================

const getConnectionTypes = (connections: UserConnection['connections']) => {
  return {
    internet: connections.some(c => c.module === 2),
    lan: connections.some(c => c.module === 1),
    ble: connections.some(c => c.module === 4)
  };
};

const getConnectionColor = (user: UserConnection): string => {
  const connectionTypes = getConnectionTypes(user.connections);
  
  if (connectionTypes.internet && connectionTypes.lan && connectionTypes.ble) {
    return '#8b5cf6';
  } else if (connectionTypes.internet && connectionTypes.lan) {
    return '#06b6d4';
  } else if (connectionTypes.internet && connectionTypes.ble) {
    return '#f59e0b';
  } else if (connectionTypes.lan && connectionTypes.ble) {
    return '#10b981';
  } else if (connectionTypes.internet) {
    return '#3b82f6';
  } else if (connectionTypes.lan) {
    return '#10b981';
  } else if (connectionTypes.ble) {
    return '#f97316';
  }
  return '#6b7280';
};



// ==================== MAIN NETWORK SETTINGS COMPONENT ====================

const areUsersEqual = (a: UserConnection[] | undefined, b: UserConnection[] | undefined): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  
  if (a.length !== b.length) return false;
  return a.every((user, index) => {
    const other = b[index];
    return (
      user.peer_id === other.peer_id &&
      user.q8id === other.q8id &&
      user.name === other.name &&
      user.is_online === other.is_online &&
      JSON.stringify(user.connections) === JSON.stringify(other.connections)
    );
  });
};

export default function NetworkSettings({
  users = [],
  loading = false,
  error = null,
  onUserClick,
}: NetworkSettingsProps) {
  const [selectedUser, setSelectedUser] = React.useState<UserConnection | null>(null);
  const [showFilters, setShowFilters] = React.useState({
    internet: true,
    lan: true,
    ble: true,
  });
  const [networkUsers, setNetworkUsers] = React.useState<UserConnection[]>([]);

  React.useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupEventListener = async () => {
      try {
        unlisten = await listen<UserConnection[]>('neighbors-updated', (event) => {
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
          
          setNetworkUsers(prevUsers => {
            if (areUsersEqual(prevUsers, parsedPayload)) {
              return prevUsers;
            }
            return parsedPayload;
          });
        });
      } catch (error) {
        console.error('Failed to setup event listener:', error);
      }
    };

    setupEventListener();

    return () => {
      if (unlisten) {
        try {
          unlisten();
        } catch (error) {
          console.error('Error cleaning up event listener:', error);
        }
      }
    };
  }, []);

  React.useEffect(() => {
    setNetworkUsers(prevUsers => {
      if (areUsersEqual(prevUsers, users)) {
        return prevUsers;
      }
      return users;
    });
  }, [users]);

  const handleUserClick = React.useCallback(
    (user: UserConnection) => {
      setSelectedUser(user);
      if (onUserClick) {
        onUserClick(user);
      }
    },
    [onUserClick]
  );

  const handleFilterChange = React.useCallback((type: keyof typeof showFilters, value: boolean) => {
    setShowFilters(prev => ({ ...prev, [type]: value }));
  }, []);

  const handleShowAll = React.useCallback(() => {
    setShowFilters({ internet: true, lan: true, ble: true });
  }, []);

  const stats = React.useMemo(() => {
    if (!Array.isArray(networkUsers)) {
      return { total: 0, internet: 0, lan: 0, ble: 0, multiConnection: 0 };
    }

    const onlineUsers = networkUsers.filter((u) => u.is_online);
    const internetUsers = onlineUsers.filter((u) => 
      u.connections.some(c => c.module === 2)
    );
    const lanUsers = onlineUsers.filter((u) => 
      u.connections.some(c => c.module === 1)
    );
    const bleUsers = onlineUsers.filter((u) => 
      u.connections.some(c => c.module === 4)
    );
    const multiConnectionUsers = onlineUsers.filter((u) => {
      const connectionTypes = getConnectionTypes(u.connections);
      return [connectionTypes.internet, connectionTypes.lan, connectionTypes.ble].filter(Boolean).length >= 2;
    });

    return {
      total: onlineUsers.length,
      internet: internetUsers.length,
      lan: lanUsers.length,
      ble: bleUsers.length,
      multiConnection: multiConnectionUsers.length,
    };
  }, [networkUsers]);

  const hasNetworkUsers = Array.isArray(networkUsers) && networkUsers.length > 0;
  
  // Also check if there are any nodes (users without connections) to display
  const hasAnyNodes = hasNetworkUsers || (Array.isArray(networkUsers) && networkUsers.some(user => 
    user.connections.length === 0 || user.connections.some(conn => conn.via_node)
  ));

  return (
    <div className="p-6 pb-18 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Network Monitor</h2>
          <p className="text-gray-600 mt-1">Real-time network topology and user connections</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-3 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
            <UserCheck className="w-5 h-5 text-green-600 animate-pulse" />
            <span className="text-sm font-semibold text-green-700">
              {stats.total} Online Users
            </span>
          </div>
        </div>
      </div>

      {/* Connection Type Filters */}
      <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Connection Filters</h3>
          <button
            onClick={handleShowAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Show All
          </button>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFilters.internet}
                onChange={(e) => handleFilterChange('internet', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Internet</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {stats.internet}
              </span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFilters.lan}
                onChange={(e) => handleFilterChange('lan', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
            <span className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Wifi className="w-4 h-4 text-green-600" />
              <span>LAN</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                {stats.lan}
              </span>
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFilters.ble}
                onChange={(e) => handleFilterChange('ble', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
            <span className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Bluetooth className="w-4 h-4 text-orange-600" />
              <span>BLE</span>
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                {stats.ble}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Panel */}
      <div className="bg-gray-100 p-4 rounded-xl border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Connection Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{stats.total}</div>
            <div className="text-gray-600">Total Users</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{stats.internet}</div>
            <div className="text-gray-600">🌐 Internet</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{stats.lan}</div>
            <div className="text-gray-600">🏠 LAN</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{stats.ble}</div>
            <div className="text-gray-600">📱 BLE</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{stats.multiConnection}</div>
            <div className="text-gray-600">🔄 Multi-Conn</div>
          </div>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
              <span className="text-gray-600">BLE</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-gray-600">Multi-Connection</span>
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
        ) : !hasAnyNodes ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <WifiOff className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">No network connections found</p>
            <p className="text-sm text-gray-500 mt-1">Try connecting to other qaul nodes</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Network className="w-16 h-16 text-blue-500 mb-4" />
            <p className="text-gray-600 font-medium">Network visualization moved to Graph View</p>
            <p className="text-sm text-gray-500 mt-1">Check the Graph View tab to see network topology</p>
          </div>
        )}
      </div>

      {/* User Details Panel */}
      {selectedUser && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Network className="w-5 h-5 text-blue-600" />
              <span>User Connection Details</span>
            </h3>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">User Profile</h4>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${getConnectionColor(selectedUser)}, #8b5cf6)`
                    }}
                  >
                    <span className="text-white font-bold text-lg">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h5 className="font-semibold text-gray-900 text-lg truncate">
                      {selectedUser.name}
                    </h5>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className={`w-2 h-2 rounded-full mr-1 ${selectedUser.is_online ? 'bg-green-400' : 'bg-red-400'}`}></span>
                      {selectedUser.is_online ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-xs text-gray-500">
                      Peer ID: {selectedUser.peer_id.substring(0, 8)}...
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Q8 ID: {selectedUser.q8id}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Connection Types</h4>
              <div className="space-y-2">
                {selectedUser.connections.some(c => c.module === 2) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>Internet</span>
                    </span>
                    <div className="text-right">
                      {(() => {
                        const conn = selectedUser.connections.find(c => c.module === 2);
                        return (
                          <>
                            {conn && (
                              <span className="text-gray-600">
                                {(conn.rtt / 1000).toFixed(2)}ms
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {selectedUser.connections.some(c => c.module === 1) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center space-x-2">
                      <Wifi className="w-4 h-4 text-green-600" />
                      <span>LAN</span>
                    </span>
                    <div className="text-right">
                      {(() => {
                        const conn = selectedUser.connections.find(c => c.module === 1);
                        return (
                          <>
                            {conn && (
                              <span className="text-gray-600">
                                {(conn.rtt / 1000).toFixed(2)}ms
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {selectedUser.connections.some(c => c.module === 4) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center space-x-2">
                      <Bluetooth className="w-4 h-4 text-orange-600" />
                      <span>Bluetooth</span>
                    </span>
                    <div className="text-right">
                      {(() => {
                        const conn = selectedUser.connections.find(c => c.module === 4);
                        return (
                          <>
                            {conn && (
                              <span className="text-gray-600">
                                {(conn.rtt / 1000).toFixed(2)}ms
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}