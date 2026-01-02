<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { Play, Square, Copy } from "lucide-svelte";
    import Check from "@lucide/svelte/icons/check";
    import { fade } from "svelte/transition";
    import InfoTooltip from "./InfoTooltip.svelte";

    let { assistantEnabled }: { assistantEnabled: boolean } = $props();

    // MCP Server state
    let mcpServerStatus = $state<{
        running: boolean;
        bind_address: string;
        server_info: {
            name: string;
            version: string;
        };
    } | null>(null);
    let mcpServerLoading = $state(false);
    let error = $state<string | null>(null);
    let hasBeenCopied = $state(false);

    async function loadMcpServerStatus() {
        mcpServerLoading = true;
        try {
            mcpServerStatus = await invoke("get_mcp_server_status");
        } catch (err) {
            console.error("Failed to get MCP server status:", err);
            mcpServerStatus = null;
        } finally {
            mcpServerLoading = false;
        }
    }

    async function startMcpServer() {
        mcpServerLoading = true;
        try {
            const result = await invoke<string>("start_mcp_server");
            console.log(result);
            await loadMcpServerStatus();
        } catch (err) {
            console.error("Failed to start MCP server:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            mcpServerLoading = false;
        }
    }

    async function stopMcpServer() {
        mcpServerLoading = true;
        try {
            const result = await invoke<string>("stop_mcp_server");
            console.log(result);
            // Wait a bit for the server to fully stop before checking status
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await loadMcpServerStatus();
        } catch (err) {
            console.error("Failed to stop MCP server:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            mcpServerLoading = false;
        }
    }

    async function toggleMcpServer() {
        if (!mcpServerStatus && assistantEnabled) {
            await startMcpServer();
        } else {
            if (mcpServerStatus?.running) {
                await stopMcpServer();
            } else {
                await startMcpServer();
            }
        }
    }

    function copyToClipboard(text: string) {
        hasBeenCopied = true;
        navigator.clipboard.writeText(text);
        setTimeout(() => {
            hasBeenCopied = false;
        }, 2000);
    }

    onMount(() => {
        loadMcpServerStatus();
    });
</script>

<!-- MCP Server Section -->
<div class="space-y-4 p-4 border rounded-lg w-full">
    <div class="flex items-center justify-between">
        <div class="w-full flex flex-row items-center justify-between">
            <div class="space-y-1">
                <div class="flex items-center gap-3">
                    <h4 class="font-medium">As MCP Server</h4>
                    <InfoTooltip
                        content="Start a Streamable HTTP server that exposes Knoly tools."
                    />
                    {#if mcpServerStatus}
                        <div
                            class={`w-2 h-2 rounded-full ${
                                mcpServerStatus.running
                                    ? mcpServerLoading
                                        ? "bg-amber-500"
                                        : "bg-green-500"
                                    : "bg-red-500"
                            }`}
                        ></div>
                    {/if}
                </div>
                <span
                    class="flex items-center gap-x-1 text-sm text-muted-foreground"
                >
                    Expose a Loyca.ai MCP server via HTTP
                </span>
            </div>

            {#if mcpServerStatus?.running}
                <Button
                    onclick={stopMcpServer}
                    disabled={mcpServerLoading}
                    variant="destructive"
                    class="flex items-center gap-2"
                >
                    <Square class="w-4 h-4" />
                    {mcpServerLoading ? "Stopping..." : "Stop Server"}
                </Button>
            {:else}
                <Button
                    onclick={startMcpServer}
                    disabled={mcpServerLoading}
                    class="flex items-center gap-2"
                >
                    <Play class="w-4 h-4" />
                    {mcpServerLoading ? "Starting..." : "Start Server"}
                </Button>
            {/if}
        </div>
    </div>

    {#if mcpServerStatus?.running && !mcpServerLoading}
        <div class="flex justify-center items-center gap-2">
            <span class=" bg-secondary/80 px-2 py-1 rounded">
                http://{mcpServerStatus.bind_address}/mcp
            </span>
            <Button
                variant="outline"
                size="icon"
                onclick={() =>
                    copyToClipboard(
                        `http://${mcpServerStatus?.bind_address}/mcp`,
                    )}
                class="relative"
            >
                <Copy />
                {#if hasBeenCopied}
                    <div transition:fade class="absolute -top-1 -right-2">
                        <Check class="size-5 text-green-500" />
                    </div>
                {/if}
            </Button>
        </div>
    {/if}
</div>
