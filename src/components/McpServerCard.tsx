import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Power, PowerOff, Trash2 } from 'lucide-react';
import AlertModal from './AlertModal.tsx';
import { MeshGradient } from "@paper-design/shaders-react";

// Types
interface McpServerConfig {
  protocol: string;
  command?: string;
  args?: string[];
  envs?: Record<string, string>;
  url?: string;
}

interface McpTool {
  name: string;
  description?: string;
  enabled: boolean;
}

interface McpServerCardProps {
  serverName: string;
  loading: boolean;
  loadServers: () => Promise<void>;
  setError?: (error: string) => void;
}

const McpServerCard: React.FC<McpServerCardProps> = ({
  serverName,
  loading,
  loadServers,
  setError,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<McpServerConfig | null>(null);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolsEnabled, setToolsEnabled] = useState<{ [key: string]: boolean }>({});

  const totalEnabledTools = Object.values(toolsEnabled).filter(Boolean).length;

  useEffect(() => {
    if (totalEnabledTools === 0) {
      setServerEnabled(false);
    } else {
      setServerEnabled(true);
    }
  }, [totalEnabledTools]);

  const handleDeleteConfirm = async () => {
    try {
      await invoke("remove_mcp_server", { name: serverName });
      await loadServers();
    } catch (err) {
      console.error("Failed to remove MCP server:", err);
      setError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setShowDeleteModal(false);
    }
  };

  const toggleServerEnabled = async (status?: boolean) => {
    const newStatus = status ?? !serverEnabled;
    try {
      await invoke("update_tool_status_by_server", {
        serverName,
        status: newStatus,
      });
      
      // Update all tools' enabled status
      await Promise.all(
        tools.map(async (tool) => {
          await toggleToolEnabled(tool.name, newStatus);
        }),
      );

      // Update local toolsEnabled state
      const updatedToolsEnabled: { [key: string]: boolean } = {};
      for (const tool of tools) {
        updatedToolsEnabled[tool.name] = newStatus;
      }
      setToolsEnabled(updatedToolsEnabled);
    } catch (err) {
      console.error("Failed to update server enabled status:", err);
      setError?.("Failed to update server status");
    }
  };

  const toggleToolEnabled = async (toolName: string, status?: boolean) => {
    const newStatus = status ?? !toolsEnabled[toolName];
    try {
      await invoke("update_tool_status", {
        serverName,
        toolName,
        status: newStatus,
      });

      // Update local state
      setToolsEnabled(prev => ({ ...prev, [toolName]: newStatus }));
    } catch (err) {
      console.error("Failed to update tool enabled status:", err);
      setError?.("Failed to update tool status");
    }
  };

  useEffect(() => {
    const loadServerData = async () => {
      try {
        const [_status, _config, _tools] = await Promise.all([
          invoke<boolean>("is_mcp_server_running", { name: serverName }),
          invoke<McpServerConfig | null>("get_mcp_server_config", {
            name: serverName,
          }),
          invoke<McpTool[]>("list_mcp_tools", {
            serverName,
          }).catch(() => []),
        ]);

        setIsRunning(_status);
        setConfig(_config);
        setTools(_tools);

        // Initialize toolsEnabled state with current tool enabled status
        const initialToolsEnabled: { [key: string]: boolean } = {};
        for (const tool of _tools) {
          initialToolsEnabled[tool.name] = tool.enabled;
        }
        setToolsEnabled(initialToolsEnabled);
      } catch (err) {
        console.error("Failed to load server data:", err);
      }
    };

    loadServerData();
  }, [serverName]);

  return (
    <div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-semibold">{serverName}</CardTitle>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isRunning && serverEnabled
                    ? 'bg-green-500'
                    : 'bg-red-500'}`}
                />
                <span className="text-sm text-muted-foreground">
                  {!serverEnabled
                    ? "Disabled"
                    : isRunning
                      ? "Running"
                      : "Stopped"}
                </span>
                {config && config.protocol && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {config.protocol}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Enable</span>
                <Switch
                  checked={serverEnabled}
                  onCheckedChange={toggleServerEnabled}
                  disabled={!isRunning}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {config && (
            <div className="px-8 space-y-4">
              <div>
                <Label className="text-sm font-medium">Protocol</Label>
                <p className="text-sm text-muted-foreground">
                  {config.protocol}
                </p>
              </div>

              {config.protocol === "stdio" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium">Command</Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {config.command}
                    </p>
                  </div>

                  {config.args && config.args.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Arguments</Label>
                      <p className="text-sm text-muted-foreground font-mono">
                        {config.args.join(" ")}
                      </p>
                    </div>
                  )}
                </div>
              ) : config.url && (
                <div>
                  <Label className="text-sm font-medium">URL</Label>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config.url}
                  </p>
                </div>
              )}

              {config.protocol === "stdio" && config.envs && Object.keys(config.envs).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Environment Variables</Label>
                  <div className="mt-2 space-y-1">
                    {Object.entries(config.envs).map(([key, value]) => (
                      <p key={key} className="text-sm text-muted-foreground font-mono">
                        {key}={value}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tools.length > 0 ? (
            <Accordion type="single" collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-medium">
                  Available Tools ({totalEnabledTools} enabled)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 max-h-80 overflow-auto">
                    {tools.map((tool) => {
                      const isToolEnabled = toolsEnabled[tool.name] ?? tool.enabled;
                      return (
                        <div
                          key={tool.name}
                          className="relative p-2 bg-gray-50 rounded border flex items-start justify-between gap-2"
                        >
                          <div className={`flex-1 ${isToolEnabled ? "" : "opacity-50"}`}>
                            <p className={`text-sm font-medium ${isToolEnabled ? "" : "line-through"}`}>
                              {tool.name}
                            </p>
                            {tool.description && (
                              <p className="text-xs text-muted-foreground mt-1 max-h-32 overflow-auto">
                                {tool.description}
                              </p>
                            )}
                          </div>

                          <Button
                            className="absolute right-0.5 top-0.5"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleToolEnabled(tool.name)}
                          >
                            {isToolEnabled ? (
                              <Power className="w-4 h-4 text-green-500" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : isRunning && (
            <p className="text-sm text-muted-foreground">No tools available</p>
          )}
        </CardContent>
        </div>
      </Card>

      <AlertModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete MCP Server"
        description={`Are you sure you want to remove server "${serverName}"? This action cannot be undone.`}
        buttonLabel="Delete Server"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default McpServerCard;
