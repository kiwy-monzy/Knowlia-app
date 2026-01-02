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

    interface LocalToolsCardProps {
        error?: string;
        loading: boolean;
        loadServers: () => Promise<void>;
    }

    let {
        error = $bindable(),
        loading = $bindable(),
        loadServers,
    }: LocalToolsCardProps = $props();

    let config = $state<McpServerConfig | null>(null);
    let serverEnabled = $state(false);
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

    async function toggleServerEnabled(status?: boolean) {
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
                serverName: "_local",
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
        const _tools = await invoke<McpTool[]>("list_mcp_tools", {
            serverName: "_local",
        }).catch(() => []);

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
        <Card.Header class="-mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <Card.Title class="text-xl font-semibold"
                        >Loyca.ai Internal Tools</Card.Title
                    >
                    <div class="flex items-center gap-2">
                        <div
                            class="w-2 h-2 rounded-full {serverEnabled
                                ? 'bg-green-500'
                                : 'bg-red-500'}"
                        ></div>
                        <span class="text-sm text-muted-foreground">
                            {!serverEnabled ? "Disabled" : "Enabled"}
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
                        />
                    </div>
                </div>
            </div>
        </Card.Header>

        <Card.Content>
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
            {/if}
        </Card.Content>
    </Card.Root>
</div>
