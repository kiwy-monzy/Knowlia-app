import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Play, Square, Copy, Check } from 'lucide-react';
import SimpleTooltip from './SimpleTooltip';

interface AsMcpServerProps {
  assistantEnabled: boolean;
}

interface McpServerStatus {
  running: boolean;
  bind_address: string;
  server_info: {
    name: string;
    version: string;
  };
}

const AsMcpServer: React.FC<AsMcpServerProps> = ({ assistantEnabled }) => {
  const [mcpServerStatus, setMcpServerStatus] = useState<McpServerStatus | null>(null);
  const [mcpServerLoading, setMcpServerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBeenCopied, setHasBeenCopied] = useState(false);

  const loadMcpServerStatus = async () => {
    setMcpServerLoading(true);
    try {
      const status = await invoke<McpServerStatus>("get_mcp_server_status");
      setMcpServerStatus(status);
    } catch (err) {
      console.error("Failed to get MCP server status:", err);
      setMcpServerStatus(null);
    } finally {
      setMcpServerLoading(false);
    }
  };

  const startMcpServer = async () => {
    setMcpServerLoading(true);
    try {
      const result = await invoke<string>("start_mcp_server");
      console.log(result);
      await loadMcpServerStatus();
    } catch (err) {
      console.error("Failed to start MCP server:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpServerLoading(false);
    }
  };

  const stopMcpServer = async () => {
    setMcpServerLoading(true);
    try {
      const result = await invoke<string>("stop_mcp_server");
      console.log(result);
      // Wait a bit for the server to fully stop before checking status
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await loadMcpServerStatus();
    } catch (err) {
      console.error("Failed to stop MCP server:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpServerLoading(false);
    }
  };

  const toggleMcpServer = async () => {
    if (!mcpServerStatus && assistantEnabled) {
      await startMcpServer();
    } else {
      if (mcpServerStatus?.running) {
        await stopMcpServer();
      } else {
        await startMcpServer();
      }
    }
  };

  const copyToClipboard = (text: string) => {
    setHasBeenCopied(true);
    navigator.clipboard.writeText(text);
    setTimeout(() => {
      setHasBeenCopied(false);
    }, 2000);
  };

  useEffect(() => {
    loadMcpServerStatus();
  }, []);

  return (
    <div className="space-y-4 p-4 border rounded-lg w-full">
      <div className="flex items-center justify-between">
        <div className="w-full flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h4 className="font-medium">As MCP Server</h4>
              <SimpleTooltip
                content="Start a Streamable HTTP server that exposes Knoly tools."
              />
              {mcpServerStatus && (
                <div
                  className={`w-2 h-2 rounded-full ${
                    mcpServerStatus.running
                      ? mcpServerLoading
                        ? "bg-amber-500"
                        : "bg-green-500"
                      : "bg-red-500"
                  }`}
                ></div>
              )}
            </div>
            <span className="flex items-center gap-x-1 text-sm text-muted-foreground">
              Expose a Knoly.ai MCP server via HTTP
            </span>
          </div>

          {mcpServerStatus?.running ? (
            <Button
              onClick={stopMcpServer}
              disabled={mcpServerLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              {mcpServerLoading ? "Stopping..." : "Stop Server"}
            </Button>
          ) : (
            <Button
              onClick={startMcpServer}
              disabled={mcpServerLoading}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {mcpServerLoading ? "Starting..." : "Start Server"}
            </Button>
          )}
        </div>
      </div>

      {mcpServerStatus?.running && !mcpServerLoading && (
        <div className="flex justify-center items-center gap-2">
          <span className="bg-secondary/80 px-2 py-1 rounded">
            http://{mcpServerStatus.bind_address}/mcp
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              copyToClipboard(
                `http://${mcpServerStatus?.bind_address}/mcp`
              )
            }
            className="relative"
          >
            <Copy className="w-4 h-4" />
            {hasBeenCopied && (
              <div className="absolute -top-1 -right-2">
                <Check className="size-5 text-green-500" />
              </div>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AsMcpServer;
