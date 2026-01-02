import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Power, PowerOff } from 'lucide-react';
import { MeshGradient } from "@paper-design/shaders-react";

// Types (reusing from McpServerCard)
interface McpTool {
  name: string;
  description?: string;
  enabled: boolean;
}

interface LocalToolsCardProps {
  error?: string;
  loading: boolean;
  loadServers: () => Promise<void>;
  setError?: (error: string) => void;
}

const LocalToolsCard: React.FC<LocalToolsCardProps> = ({
  error,
  loading,
  loadServers,
  setError,
}) => {
  const [serverEnabled, setServerEnabled] = useState(false);
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

  const toggleServerEnabled = async (status?: boolean) => {
    const newStatus = status ?? !serverEnabled;
    try {
      await invoke("update_tool_status_by_server", {
        serverName: "_local",
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
        serverName: "_local",
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
    const loadLocalTools = async () => {
      try {
        const _tools = await invoke<McpTool[]>("list_mcp_tools", {
          serverName: "_local",
        }).catch(() => []);

        setTools(_tools);

        // Initialize toolsEnabled state with current tool enabled status
        const initialToolsEnabled: { [key: string]: boolean } = {};
        for (const tool of _tools) {
          initialToolsEnabled[tool.name] = tool.enabled;
        }
        setToolsEnabled(initialToolsEnabled);
      } catch (err) {
        console.error("Failed to load local tools:", err);
      }
    };

    loadLocalTools();
  }, []);

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
          <CardHeader className="-mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-semibold">Loyca.ai Internal Tools</CardTitle>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${serverEnabled
                      ? 'bg-green-500'
                      : 'bg-red-500'}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {!serverEnabled ? "Disabled" : "Enabled"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Enable</span>
                <Switch
                  checked={serverEnabled}
                  onCheckedChange={toggleServerEnabled}
                />
              </div>
            </div>
          </CardHeader>

        <CardContent>
          {tools.length > 0 && (
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
          )}
        </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default LocalToolsCard;
