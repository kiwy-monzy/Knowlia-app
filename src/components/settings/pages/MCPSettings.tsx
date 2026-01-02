import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plug, Plus, Trash2, CheckCircle, XCircle, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { MeshGradient } from "@paper-design/shaders-react";

interface MCPServer {
  name: string;
  running: boolean;
  type: 'local' | 'external';
  url?: string;
}

const MCPSettings = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoStartLocalServer, setAutoStartLocalServer] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    protocol: 'streamable',
    url: '',
    command: '',
    args: '',
    envs: '',
  });

  // Load servers from backend
  const loadServers = async () => {
    try {
      // Load external MCP servers
      const serverNames = await invoke<string[]>('list_mcp_servers');
      const externalServers = await Promise.all(
        serverNames.map(async (name) => {
          const running = await invoke<boolean>('is_mcp_server_running', { serverId: name });
          return { name, running, type: 'external' as const };
        })
      );

      // Load local MCP server status
      let localServer = { name: 'Local MCP Server', running: false, type: 'local' as const };
      try {
        const localStatus = await invoke<any>('get_mcp_server_status');
        localServer.running = localStatus.running;
      } catch (error) {
        console.log('Local MCP server status not available');
      }

      setServers([localServer, ...externalServers]);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      toast.error('Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  // Check server status
  const checkServerStatus = async (serverName: string, serverType: 'local' | 'external') => {
    try {
      let isRunning = false;
      
      if (serverType === 'local') {
        const status = await invoke<any>('get_mcp_server_status');
        isRunning = status.running;
      } else {
        isRunning = await invoke<boolean>('is_mcp_server_running', { serverId: serverName });
      }
      
      setServers(prev => prev.map(s => 
        s.name === serverName ? { ...s, running: isRunning } : s
      ));
    } catch (error) {
      console.error(`Failed to check status for server ${serverName}:`, error);
    }
  };

  // Load server tools
  const loadServerTools = async (serverName: string) => {
    try {
      const tools = await invoke<string[]>('list_mcp_tools', { serverName });
      // Tools are stored in database, we can show them if needed
      console.log(`Tools for ${serverName}:`, tools);
    } catch (error) {
      console.error(`Failed to load tools for server ${serverName}:`, error);
    }
  };

  useEffect(() => {
    loadServers();
    // Load auto-start setting from localStorage
    const saved = localStorage.getItem('autoStartLocalServer');
    if (saved) {
      setAutoStartLocalServer(JSON.parse(saved));
    }
  }, []);

  // Handle auto-start local server
  useEffect(() => {
    if (autoStartLocalServer && servers.length > 0) {
      const localServer = servers.find(s => s.type === 'local');
      if (localServer && !localServer.running) {
        // Auto-start the local server
        invoke('start_mcp_server').catch(console.error);
        setTimeout(() => checkServerStatus(localServer.name, 'local'), 1000);
      }
    }
  }, [autoStartLocalServer, servers]);


  const handleAddServer = async () => {
    if (!newServer.name) {
      toast.error('Please fill in server name');
      return;
    }

    try {
      const params: any = {
        name: newServer.name,
        protocol: newServer.protocol,
      };

      if (newServer.protocol === 'stdio') {
        if (!newServer.command) {
          toast.error('Command is required for stdio protocol');
          return;
        }
        params.command = newServer.command;
        params.args = newServer.args ? newServer.args.split(' ').filter(Boolean) : [];
        params.envs = newServer.envs ? Object.fromEntries(
          newServer.envs.split(',').map(e => e.split('=').map(s => s.trim()))
        ) : {};
      } else {
        if (!newServer.url) {
          toast.error('URL is required for http-based protocols');
          return;
        }
        params.url = newServer.url;
      }

      await invoke('add_mcp_server', params);
      
      setNewServer({ name: '', protocol: 'streamable', url: '', command: '', args: '', envs: '' });
      toast.success('MCP server added');
      loadServers(); // Refresh list
    } catch (error) {
      console.error('Failed to add MCP server:', error);
      toast.error('Failed to add MCP server');
    }
  };

  const handleRemoveServer = async (name: string) => {
    try {
      await invoke('remove_mcp_server', { name });
      toast.success('MCP server removed');
      loadServers(); // Refresh list
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
      toast.error('Failed to remove MCP server');
    }
  };

  const handleToggleServer = async (name: string, type: 'local' | 'external') => {
    try {
      if (type === 'local') {
        // Handle local MCP server
        const server = servers.find(s => s.name === name);
        if (!server) return;

        if (server.running) {
          await invoke('stop_mcp_server');
          toast.success('Local MCP server stopped');
        } else {
          await invoke('start_mcp_server');
          toast.success('Local MCP server started');
        }
        
        // Refresh status
        setTimeout(() => checkServerStatus(name, 'local'), 500);
      } else {
        // External MCP servers are managed automatically
        toast.info('External MCP servers are managed automatically');
      }
    } catch (error) {
      console.error('Failed to toggle MCP server:', error);
      toast.error('Failed to toggle MCP server');
    }
  };

  const handleRefreshServer = async (name: string, type: 'local' | 'external') => {
    await checkServerStatus(name, type);
    if (type === 'external') {
      await loadServerTools(name);
    }
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">MCP Settings</h1>
        <p className="text-muted-foreground">Configure Model Context Protocol connections</p>
      </div>

      <Card className="relative overflow-hidden">
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
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            MCP Servers
          </CardTitle>
          <CardDescription>Manage your MCP server connections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading MCP servers...</div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No MCP servers configured</div>
          ) : (
            servers.map((server) => (
              <div
                key={server.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{server.name}</h4>
                    <Badge variant={server.running ? 'default' : 'secondary'}>
                      {server.running ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {server.type === 'local' ? 'Running' : 'Connected'}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          {server.type === 'local' ? 'Stopped' : 'Disconnected'}
                        </>
                      )}
                    </Badge>
                    {server.type === 'local' && (
                      <Badge variant="outline" className="text-xs">
                        Port 8000
                      </Badge>
                    )}
                  </div>
                  {server.url && (
                    <p className="text-sm text-muted-foreground">{server.url}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRefreshServer(server.name, server.type)}
                    title="Refresh server status"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {server.type === 'local' ? (
                    <Button
                      variant={server.running ? "default" : "secondary"}
                      size="sm"
                      onClick={() => handleToggleServer(server.name, server.type)}
                    >
                      {server.running ? 'Stop' : 'Start'}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveServer(server.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
        </div>
      </Card>

      <Card className="relative overflow-hidden">
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
          <CardHeader>
          <CardTitle>Add New MCP Server</CardTitle>
          <CardDescription>Connect to a new Model Context Protocol server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Server Name</Label>
            <Input
              id="server-name"
              placeholder="My MCP Server"
              value={newServer.name}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol</Label>
            <select
              id="protocol"
              className="w-full p-2 border rounded-md"
              value={newServer.protocol}
              onChange={(e) => setNewServer({ ...newServer, protocol: e.target.value })}
              aria-label="Select MCP server protocol"
              title="Choose the communication protocol for the MCP server"
            >
              <option value="streamable">Streamable (HTTP)</option>
              <option value="sse">Server-Sent Events</option>
              <option value="stdio">Standard I/O</option>
            </select>
          </div>

          {newServer.protocol !== 'stdio' ? (
            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                placeholder="http://localhost:3000"
                value={newServer.url}
                onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  placeholder="npx"
                  value={newServer.command}
                  onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="args">Arguments (space-separated)</Label>
                <Input
                  id="args"
                  placeholder="-y @modelcontextprotocol/server-filesystem ."
                  value={newServer.args}
                  onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="envs">Environment Variables (comma-separated, key=value)</Label>
                <Input
                  id="envs"
                  placeholder="NODE_ENV=production,API_KEY=secret"
                  value={newServer.envs}
                  onChange={(e) => setNewServer({ ...newServer, envs: e.target.value })}
                />
              </div>
            </>
          )}
        </CardContent>
        </div>
      </Card>

      <Card className="relative overflow-hidden">
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
          <CardHeader>
          <CardTitle>MCP Configuration</CardTitle>
          <CardDescription>Advanced MCP settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-connect on Startup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically connect to enabled servers
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Retry Failed Connections</Label>
              <p className="text-sm text-muted-foreground">
                Attempt to reconnect if connection fails
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Connection Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              defaultValue="30"
              min="5"
              max="120"
            />
          </div>
        </CardContent>
        </div>
      </Card>

      <Button onClick={handleAddServer} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Server
      </Button>

      <div className="pt-4">
        <Button onClick={loadServers} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Server List
        </Button>
      </div>

      <Button onClick={() => window.location.reload()} className="gap-2">
        <Save className="h-4 w-4" />
        Save Settings
      </Button>
    </div>
  );
};

export default MCPSettings;
