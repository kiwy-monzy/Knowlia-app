import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import McpServerCard from './McpServerCard.tsx';
import LocalToolsCard from './LocalToolsCard.tsx';
import { MeshGradient } from "@paper-design/shaders-react";

// Define types
type ProtocolType = 'stdio' | 'streamable' | 'sse';

interface ProtocolOption {
  value: ProtocolType;
  label: string;
}

const ToolsManagement: React.FC = () => {
  // State
  const [servers, setServers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state for adding new server
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerProtocol, setNewServerProtocol] = useState<ProtocolType>('stdio');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [newServerArgs, setNewServerArgs] = useState('');
  const [newServerEnvs, setNewServerEnvs] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');

  // Constants
  const protocolOptions: ProtocolOption[] = [
    { value: 'stdio', label: 'Stdio' },
    { value: 'streamable', label: 'Streamable HTTP' },
    { value: 'sse', label: 'Server-Sent Events' },
  ];

  // Functions
  const loadServers = async () => {
    setLoading(true);
    setError('');

    try {
      // Load server list
      const serverList = await invoke<string[]>('list_mcp_servers');
      setServers(serverList);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const addServer = async () => {
    // Validate required fields based on protocol
    if (!newServerName.trim()) {
      setError('Server name is required');
      return;
    }

    if (newServerProtocol === 'stdio' && !newServerCommand.trim()) {
      setError('Command is required for stdio protocol');
      return;
    }

    if ((newServerProtocol === 'streamable' || newServerProtocol === 'sse') && !newServerUrl.trim()) {
      setError('URL is required for streamable and SSE protocols');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const args = newServerArgs.trim()
        ? newServerArgs.split(/\s+/).filter((arg) => arg.length > 0)
        : [];

      const envs = newServerEnvs.trim()
        ? parseEnvVars(newServerEnvs)
        : undefined;

      await invoke('add_mcp_server', {
        name: newServerName.trim(),
        protocol: newServerProtocol,
        command: newServerCommand.trim() || undefined,
        args: args.length > 0 ? args : undefined,
        envs,
        url: newServerUrl.trim() || undefined,
      });

      // Reset form
      setNewServerName('');
      setNewServerProtocol('stdio');
      setNewServerCommand('');
      setNewServerArgs('');
      setNewServerEnvs('');
      setNewServerUrl('');
      setShowAddForm(false);

      // Reload servers
      await loadServers();
    } catch (err) {
      console.error('Failed to add MCP server:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const parseEnvVars = (envString: string): Record<string, string> => {
    const envs: Record<string, string> = {};
    const lines = envString.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envs[key.trim()] = valueParts.join('=').trim();
      }
    }

    return envs;
  };

  const formatEnvVars = (envs: Record<string, string>): string => {
    return Object.entries(envs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  };

  // Effects
  useEffect(() => {
    loadServers();
  }, []);

  return (
    <div className="space-y-6">
      {/* MCP Client Servers Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            MCP Client Servers
          </h2>
          <p className="text-muted-foreground">
            Manage external Model Context Protocol servers and their tools
          </p>
        </div>

        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {showAddForm && (
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input
                    id="server-name"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="e.g., filesystem"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server-protocol">Protocol</Label>
                  <Select
                    value={newServerProtocol}
                    onValueChange={(value: ProtocolType) => setNewServerProtocol(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Protocol">
                        {protocolOptions.find(
                          (option) => option.value === newServerProtocol,
                        )?.label ?? 'Select Protocol'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {protocolOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newServerProtocol === 'stdio' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="server-command">Command</Label>
                    <Input
                      id="server-command"
                      value={newServerCommand}
                      onChange={(e) => setNewServerCommand(e.target.value)}
                      placeholder="e.g., npx"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="server-args">Arguments</Label>
                    <Input
                      id="server-args"
                      value={newServerArgs}
                      onChange={(e) => setNewServerArgs(e.target.value)}
                      placeholder="e.g., -y @modelcontextprotocol/server-filesystem ."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="server-envs">
                      Environment Variables (optional)
                    </Label>
                    <Textarea
                      id="server-envs"
                      value={newServerEnvs}
                      onChange={(e) => setNewServerEnvs(e.target.value)}
                      placeholder="KEY1=value1\nKEY2=value2"
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="server-url">
                    {newServerProtocol === 'streamable'
                      ? 'Streamable HTTP URL'
                      : 'SSE URL'}
                  </Label>
                  <Input
                    id="server-url"
                    value={newServerUrl}
                    onChange={(e) => setNewServerUrl(e.target.value)}
                    placeholder={
                      newServerProtocol === 'streamable'
                        ? 'e.g., http://localhost:3000/mcp'
                        : 'e.g., http://localhost:3000/sse'
                    }
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={addServer} disabled={loading}>
                  {loading ? 'Adding...' : 'Add Server'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {loading && servers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading servers...</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No MCP servers configured</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {servers.map((serverName) => (
            <McpServerCard
              key={serverName}
              serverName={serverName}
              setError={setError}
              loading={loading}
              loadServers={loadServers}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={loadServers} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="border-t border-gray-200 my-6"></div>
      <div className="flex flex-col gap-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Local Tools</h2>
          <p className="text-muted-foreground">Manage Loyca.ai internal tools</p>
        </div>
        <LocalToolsCard
          error={error}
          setError={setError}
          loading={loading}
          loadServers={loadServers}
        />
      </div>
    </div>
  );
};

export default ToolsManagement;