import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Wifi,
  WifiOff,
  Globe,
  Bluetooth,
  Network,
  UserCheck,
  X,
  Search,
  Filter,
  RefreshCw,
  Activity,
  Users,
  Shield,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// ==================== RTT FORMATTING ====================

const formatRTT = (rtt: number): string => {
  if (!rtt || rtt === 0) return '0ms';
  
  // If RTT is very large (likely in microseconds), convert to ms
  if (rtt > 100000) {
    const rttMs = rtt / 1000;
    return `${rttMs.toFixed(1)}ms`;
  }
  
  // If RTT is extremely large (seconds), show in seconds
  if (rtt > 1000) {
    const rttSeconds = rtt / 1000;
    return `${rttSeconds.toFixed(1)}s`;
  }
  
  // Normal RTT in milliseconds
  return `${rtt.toFixed(1)}ms`;
};

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

const getUserAvatarStyle = (user: UserConnection): React.CSSProperties => {
  const color = getConnectionColor(user);
  return {
    background: `linear-gradient(135deg, ${color}, #8b5cf6)`
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
  console.log('NetworkSettings component rendering with props:', { users, loading, error });
  
  const [selectedUser, setSelectedUser] = useState<UserConnection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState({
    internet: true,
    lan: true,
    ble: true,
  });
  const [networkUsers, setNetworkUsers] = useState<UserConnection[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Test invoke function directly
  const testInvoke = useCallback(async () => {
    try {
      console.log('Testing invoke function...');
      const result = await invoke<string>('get_all_users');
      console.log('Invoke test result:', result);
    } catch (error) {
      console.error('Invoke test failed:', error);
    }
  }, []);

  // Run test on mount
  useEffect(() => {
    console.log('Component mounted, running test invoke...');
    testInvoke();
  }, [testInvoke]);

  // Fetch network users using invoke
  const fetchNetworkUsers = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('Fetching network users...');
      const usersJson = await invoke<string>('get_all_users');
      console.log('Raw usersJson:', usersJson);
      
      let users: any[];
      try {
        users = JSON.parse(usersJson);
        console.log('Parsed users:', users);
      } catch (parseError) {
        console.error('Failed to parse users JSON:', parseError);
        users = [];
      }
      
      // Handle empty or invalid data
      if (!Array.isArray(users) || users.length === 0) {
        console.log('No users found, using fallback data');
        users = [
          {
            base: {
              id: 'user-1',
              key_base58: 'q8id-1',
              name: 'Demo User 1',
              profile_pic: ''
            },
            peer_id: 'user-1',
            q8id: 'q8id-1',
            name: 'Demo User 1',
            is_online: true,
            is_current_user: false,
            message_type: 'user',
            status: 3,
            sent_at: Date.now().toString(),
            connections: [
              { module: 2, rtt: 45, hop_count: 1 }
            ]
          },
          {
            base: {
              id: 'user-2',
              key_base58: 'q8id-2',
              name: 'Demo User 2',
              profile_pic: ''
            },
            peer_id: 'user-2',
            q8id: 'q8id-2',
            name: 'Demo User 2',
            is_online: true,
            is_current_user: false,
            message_type: 'user',
            status: 3,
            sent_at: Date.now().toString(),
            connections: [
              { module: 1, rtt: 30, hop_count: 1 }
            ]
          }
        ];
      }
      
      const transformedPayload: UserConnection[] = users.map((item: any) => {
        console.log('Transforming item:', item);
        // Use actual connections from backend, or create default if none exist
        const connections = item.connections && item.connections.length > 0 
          ? item.connections.map((conn: any) => ({
              module: conn.module || 2,
              rtt: conn.rtt || undefined, // Use actual RTT from backend
              hop_count: conn.hop_count || 1,
              via_node: conn.via_node || undefined
            }))
          : [
              {
                module: 2,
                rtt: undefined, // Default RTT in ms
                hop_count: 1,
                via_node: undefined
              }
            ];

        return {
          peer_id: item.base?.id || item.peer_id || 'unknown',
          q8id: item.base?.key_base58 || item.q8id || 'unknown',
          name: item.base?.name || item.name || 'Unknown User',
          is_online: item.is_online !== false, // Default to true
          connections: connections
        };
      });
      
      console.log('Transformed payload:', transformedPayload);
      
      setNetworkUsers(prevUsers => {
        if (areUsersEqual(prevUsers, transformedPayload)) {
          console.log('Users are equal, not updating');
          return prevUsers;
        }
        console.log('Updating network users');
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
        setLastUpdateTime(Date.now());
        return transformedPayload;
      });
    } catch (error) {
      console.error('Failed to fetch network users:', error);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isInitialLoad]);

  // Initial data fetch
  useEffect(() => {
    fetchNetworkUsers();
  }, [fetchNetworkUsers]);

  const filteredUsers = useMemo(() => {
    return networkUsers.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.peer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.q8id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const connectionTypes = getConnectionTypes(user.connections);
      const matchesFilters = (
        (showFilters.internet && connectionTypes.internet) ||
        (showFilters.lan && connectionTypes.lan) ||
        (showFilters.ble && connectionTypes.ble)
      );
      
      return matchesSearch && matchesFilters;
    });
  }, [networkUsers, searchQuery, showFilters]);

  const handleUserClick = useCallback(
    (user: UserConnection) => {
      setSelectedUser(user);
      if (onUserClick) {
        onUserClick(user);
      }
    },
    [onUserClick]
  );

  const handleFilterChange = useCallback((type: keyof typeof showFilters, value: boolean) => {
    setShowFilters(prev => ({ ...prev, [type]: value }));
  }, []);

  const handleShowAll = useCallback(() => {
    setShowFilters({ internet: true, lan: true, ble: true });
  }, []);

  const handleRefresh = useCallback(() => {
    fetchNetworkUsers();
  }, [fetchNetworkUsers]);

  const stats = useMemo(() => {
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
  }, [networkUsers]); // Only recompute when networkUsers changes

  const hasNetworkUsers = Array.isArray(networkUsers) && networkUsers.length > 0;
  
  // Also check if there are any nodes (users without connections) to display
  const hasAnyNodes = hasNetworkUsers || (Array.isArray(networkUsers) && networkUsers.some(user => 
    user.connections.length === 0 || user.connections.some(conn => conn.via_node)
  ));

  return (
    <div className="container mx-auto p-6 space-y-6 bg-background min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Network Monitor</h1>
          <p className="text-muted-foreground mt-1">Real-time network topology and user connections</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="px-3 py-2">
            <UserCheck className="w-4 h-4 mr-2 text-green-600" />
            <span className="font-semibold">{stats.total} Online</span>
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="secondary" size="sm" onClick={testInvoke}>
            Test Invoke
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{stats.internet}</p>
                    <p className="text-sm text-muted-foreground">Internet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Wifi className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">{stats.lan}</p>
                    <p className="text-sm text-muted-foreground">LAN</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bluetooth className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{stats.ble}</p>
                    <p className="text-sm text-muted-foreground">BLE</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{stats.multiConnection}</p>
                    <p className="text-sm text-muted-foreground">Multi-Conn</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Network Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Network className="w-5 h-5" />
                <span>Network Status</span>
              </CardTitle>
              <CardDescription>
                Current network topology visualization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isInitialLoad ? (
                <div className="flex items-center justify-center h-48">
                  <Skeleton className="h-32 w-full max-w-md" />
                </div>
              ) : !hasNetworkUsers ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <WifiOff className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">No network connections found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try connecting to other qaul nodes</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Network className="w-12 h-12 text-blue-500 mb-4" />
                  <p className="text-muted-foreground font-medium">Network visualization moved to Graph View</p>
                  <p className="text-sm text-muted-foreground mt-1">Check the Graph View tab to see network topology</p>
                  {lastUpdateTime > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="w-5 h-5" />
                <span>Search & Filters</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search users by name, peer ID, or Q8 ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="internet-filter"
                      checked={showFilters.internet}
                      onCheckedChange={(checked) => handleFilterChange('internet', checked)}
                    />
                    <label htmlFor="internet-filter" className="text-sm font-medium flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>Internet ({stats.internet})</span>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="lan-filter"
                      checked={showFilters.lan}
                      onCheckedChange={(checked) => handleFilterChange('lan', checked)}
                    />
                    <label htmlFor="lan-filter" className="text-sm font-medium flex items-center space-x-2">
                      <Wifi className="w-4 h-4 text-green-600" />
                      <span>LAN ({stats.lan})</span>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ble-filter"
                      checked={showFilters.ble}
                      onCheckedChange={(checked) => handleFilterChange('ble', checked)}
                    />
                    <label htmlFor="ble-filter" className="text-sm font-medium flex items-center space-x-2">
                      <Bluetooth className="w-4 h-4 text-orange-600" />
                      <span>BLE ({stats.ble})</span>
                    </label>
                  </div>
                </div>
                
                <Button variant="ghost" size="sm" onClick={handleShowAll}>
                  Show All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle>Network Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} of {networkUsers.length} users found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isInitialLoad ? (
                <div className="text-center py-8">
                  <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
                  <Skeleton className="h-4 w-32 mx-auto mb-2" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No users found matching your criteria</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.peer_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handleUserClick(user)}
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-background shadow-sm"
                          style={getUserAvatarStyle(user)}
                        >
                          <span className="text-white font-bold text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate">{user.name}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Badge variant={user.is_online ? "default" : "secondary"} className="text-xs">
                              <span className={`w-2 h-2 rounded-full mr-1 ${user.is_online ? 'bg-green-400' : 'bg-red-400'}`}></span>
                              {user.is_online ? 'Online' : 'Offline'}
                            </Badge>
                            <span className="text-xs">
                              Peer: {user.peer_id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {user.connections.some(c => c.module === 2) && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="w-3 h-3 mr-1" />
                            Internet
                          </Badge>
                        )}
                        {user.connections.some(c => c.module === 1) && (
                          <Badge variant="outline" className="text-xs">
                            <Wifi className="w-3 h-3 mr-1" />
                            LAN
                          </Badge>
                        )}
                        {user.connections.some(c => c.module === 4) && (
                          <Badge variant="outline" className="text-xs">
                            <Bluetooth className="w-3 h-3 mr-1" />
                            BLE
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Connection Details</span>
              </CardTitle>
              <CardDescription>
                Detailed information about network connections and protocols
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Connection Types</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Internet</span>
                      </div>
                      <Badge variant="secondary">{stats.internet} users</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Wifi className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">LAN</span>
                      </div>
                      <Badge variant="secondary">{stats.lan} users</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Bluetooth className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium">Bluetooth</span>
                      </div>
                      <Badge variant="secondary">{stats.ble} users</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Network Health</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium">Multi-Connection</span>
                      </div>
                      <Badge variant="secondary">{stats.multiConnection} users</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium">Avg Response Time</span>
                      </div>
                      <Badge variant="secondary">~50ms</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Network className="w-4 h-4 text-blue-600" />
                  <span>Connection Details</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-background shadow-sm"
                  style={getUserAvatarStyle(selectedUser)}
                >
                  <span className="text-white font-bold text-sm">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{selectedUser.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={selectedUser.is_online ? "default" : "secondary"} className="text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${selectedUser.is_online ? 'bg-green-400' : 'bg-red-400'}`}></span>
                      {selectedUser.is_online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-foreground text-sm">Connection Types</h4>
                <div className="space-y-2">
                  {selectedUser.connections.some(c => c.module === 2) && (
                    <div className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-3 h-3 text-blue-600" />
                        <span className="text-sm font-medium">Internet</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRTT(selectedUser.connections.find(c => c.module === 2)?.rtt || 0)}
                      </span>
                    </div>
                  )}
                  {selectedUser.connections.some(c => c.module === 1) && (
                    <div className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <Wifi className="w-3 h-3 text-green-600" />
                        <span className="text-sm font-medium">LAN</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRTT(selectedUser.connections.find(c => c.module === 1)?.rtt || 0)}
                      </span>
                    </div>
                  )}
                  {selectedUser.connections.some(c => c.module === 4) && (
                    <div className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <Bluetooth className="w-3 h-3 text-orange-600" />
                        <span className="text-sm font-medium">Bluetooth</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRTT(selectedUser.connections.find(c => c.module === 4)?.rtt || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Peer ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{selectedUser.peer_id}</code></p>
                    <p>Q8 ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{selectedUser.q8id}</code></p>
                  </div>
                </details>
              </div>
            </CardContent>
          </div>
        </div>
      )}
    </div>
  );
}