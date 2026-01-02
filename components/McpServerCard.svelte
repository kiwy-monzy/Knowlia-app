<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { invoke } from "@tauri-apps/api/core";
    import Button from "./ui/button/button.svelte";
    import * as Accordion from "$lib/components/ui/accordion";
    import Label from "./ui/label/label.svelte";
    import Switch from "./ui/switch/switch.svelte";
    import { Power, PowerOff, Trash2 } from "lucide-svelte";
    import type { McpServerConfig, McpTool } from "$lib/types";
    import { onMount } from "svelte";
    import AlertModal from "./AlertModal.svelte";

    interface McpServerCardProps {
        serverName: string;
        error?: string;
        loading: boolean;
        loadServers: () => Promise<void>;
    }

    let {
        serverName,
        error = $bindable(),
        loading = $bindable(),
        loadServers,
    }: McpServerCardProps = $props();

    let isRunning = $state(false);
    let config = $state<McpServerConfig | null>(null);
    let serverEnabled = $state(false);
    let showDeleteModal = $state(false);
    let tools = $state<McpTool[]>([]);
    let toolsEnabled = $state<{ [key: string]: boolean }>({});
    let totalEnabledTools = $derived(
        Object.values(toolsEnabled).filter(Boolean).length,
    );

    $effect(() => {
        if (totalEnabledTools === 0) {
            serverEnabled = false;
        } else {
            serverEnabled = true;
        }
    });

    async function handleDeleteConfirm() {
        loading = true;
        error = "";

        try {
            await invoke("remove_mcp_server", { name: serverName });
            await loadServers();
        } catch (err) {
            console.error("Failed to remove MCP server:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            showDeleteModal = false;
            loading = false;
        }
    }

    async function toggleServerEnabled(status?: boolean) {
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
            toolsEnabled = updatedToolsEnabled;
        } catch (err) {
            console.error("Failed to update server enabled status:", err);
            error = "Failed to update server status";
        }
    }

    async function toggleToolEnabled(toolName: string, status?: boolean) {
        const newStatus = status ?? !toolsEnabled[toolName];
        try {
            await invoke("update_tool_status", {
                serverName,
                toolName,
                status: newStatus,
            });

            // Update local state
            toolsEnabled = { ...toolsEnabled, [toolName]: newStatus };
        } catch (err) {
            console.error("Failed to update tool enabled status:", err);
            error = "Failed to update tool status";
        }
    }

    onMount(async () => {
        const [_status, _config, _tools] = await Promise.all([
            invoke<boolean>("is_mcp_server_running", { name: serverName }),
            invoke<McpServerConfig | null>("get_mcp_server_config", {
                name: serverName,
            }),
            invoke<McpTool[]>("list_mcp_tools", {
                serverName,
            }).catch(() => []),
        ]);

        isRunning = _status;
        config = _config;
        tools = _tools;

        // Initialize toolsEnabled state with current tool enabled status
        const initialToolsEnabled: { [key: string]: boolean } = {};
        for (const tool of _tools) {
            initialToolsEnabled[tool.name] = tool.enabled;
        }
        toolsEnabled = initialToolsEnabled;
    });
</script>

<div>
    <Card.Root>
        <Card.Header>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <Card.Title class="text-xl font-semibold"
                        >{serverName}</Card.Title
                    >
                    <div class="flex items-center gap-2">
                        <div
                            class="w-2 h-2 rounded-full {isRunning &&
                            serverEnabled
                                ? 'bg-green-500'
                                : 'bg-red-500'}"
                        ></div>
                        <span class="text-sm text-muted-foreground">
                            {!serverEnabled
                                ? "Disabled"
                                : isRunning
                                  ? "Running"
                                  : "Stopped"}
                        </span>
                        {#if config && config.protocol}
                            <span class="text-xs bg-gray-100 px-2 py-1 rounded">
                                {config.protocol}
                            </span>
                        {/if}
                    </div>
                </div>

                <div class="flex items-center gap-8">
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-muted-foreground">Enable</span
                        >
                        <Switch
                            bind:checked={serverEnabled}
                            onCheckedChange={(checked) =>
                                toggleServerEnabled(checked)}
                            disabled={!isRunning}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => (showDeleteModal = true)}
                        class="text-red-600 hover:text-red-700"
                    >
                        <Trash2 class="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card.Header>

        <Card.Content>
            {#if config}
                <div class="px-8 space-y-4">
                    <div>
                        <Label class="text-sm font-medium">Protocol</Label>
                        <p class="text-sm text-muted-foreground">
                            {config.protocol}
                        </p>
                    </div>

                    {#if config.protocol === "stdio"}
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label class="text-sm font-medium"
                                    >Command</Label
                                >
                                <p
                                    class="text-sm text-muted-foreground font-mono"
                                >
                                    {config.command}
                                </p>
                            </div>

                            {#if config.args && config.args.length > 0}
                                <div>
                                    <Label class="text-sm font-medium"
                                        >Arguments</Label
                                    >
                                    <p
                                        class="text-sm text-muted-foreground font-mono"
                                    >
                                        {config.args.join(" ")}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        {#if config.envs && Object.keys(config.envs).length > 0}
                            <div>
                                <Label class="text-sm font-medium"
                                    >Environment Variables</Label
                                >
                                <div class="mt-2 space-y-1">
                                    {#each Object.entries(config.envs) as [key, value]}
                                        <p
                                            class="text-sm text-muted-foreground font-mono"
                                        >
                                            {key}={value}
                                        </p>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {:else if config.url}
                        <div>
                            <Label class="text-sm font-medium">URL</Label>
                            <p class="text-sm text-muted-foreground font-mono">
                                {config.url}
                            </p>
                        </div>
                    {/if}
                </div>
            {/if}

            {#if tools.length > 0}
                <Accordion.Root type="single">
                    <Accordion.Item value="item-1">
                        <Accordion.Trigger class="text-base font-medium">
                            Available Tools ({totalEnabledTools} enabled)
                        </Accordion.Trigger>

                        <Accordion.Content>
                            <div
                                class="grid grid-cols-1 gap-2 lg:grid-cols-2 max-h-80 overflow-auto"
                            >
                                {#each tools as tool}
                                    {@const isToolEnabled =
                                        toolsEnabled[tool.name] ?? tool.enabled}
                                    <div
                                        class="relative p-2 bg-gray-50 rounded border flex items-start justify-between gap-2"
                                    >
                                        <div
                                            class={`flex-1 ${isToolEnabled ? "" : "opacity-50"}`}
                                        >
                                            <p
                                                class={`text-sm font-medium ${isToolEnabled ? "" : "line-through"}`}
                                            >
                                                {tool.name}
                                            </p>
                                            {#if tool.description}
                                                <p
                                                    class="text-xs text-muted-foreground mt-1 max-h-32 overflow-auto"
                                                >
                                                    {tool.description}
                                                </p>
                                            {/if}
                                        </div>

                                        <Button
                                            class="absolute right-0.5 top-0.5"
                                            variant="ghost"
                                            size="icon"
                                            onclick={() =>
                                                toggleToolEnabled(tool.name)}
                                        >
                                            {#if isToolEnabled}
                                                <Power
                                                    class="w-4 h-4 text-green-500"
                                                />
                                            {:else}
                                                <PowerOff
                                                    class="w-4 h-4 text-red-500"
                                                />
                                            {/if}
                                        </Button>
                                    </div>
                                {/each}
                            </div>
                        </Accordion.Content>
                    </Accordion.Item>
                </Accordion.Root>
            {:else if isRunning}
                <p class="text-sm text-muted-foreground">No tools available</p>
            {/if}
        </Card.Content>
    </Card.Root>

    <AlertModal
        bind:open={showDeleteModal}
        title="Delete MCP Server"
        description={`Are you sure you want to remove server "${serverName}"? This action cannot be undone.`}
        buttonLabel="Delete Server"
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => {
            showDeleteModal = open;
        }}
    />
</div>
