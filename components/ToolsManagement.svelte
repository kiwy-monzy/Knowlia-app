<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select/index.js";
    import Input from "$lib/components/ui/input/input.svelte";
    import Label from "$lib/components/ui/label/label.svelte";
    import Textarea from "$lib/components/ui/textarea/textarea.svelte";
    import { Plus } from "lucide-svelte";
    import McpServerCard from "./McpServerCard.svelte";
    import LocalToolsCard from "./LocalToolsCard.svelte";

    let servers = $state<string[]>([]);
    let loading = $state(false);
    let error = $state("");

    // Form state for adding new server
    let showAddForm = $state(false);
    let newServerName = $state("");
    let newServerProtocol = $state<"stdio" | "streamable" | "sse">("stdio");
    let newServerCommand = $state("");
    let newServerArgs = $state("");
    let newServerEnvs = $state("");
    let newServerUrl = $state("");

    const protocolOptions = [
        { value: "stdio", label: "Stdio" },
        { value: "streamable", label: "Streamable HTTP" },
        { value: "sse", label: "Server-Sent Events" },
    ];

    async function loadServers() {
        loading = true;
        error = "";

        try {
            // Load server list
            servers = await invoke<string[]>("list_mcp_servers");
        } catch (err) {
            console.error("Failed to load MCP servers:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    async function addServer() {
        // Validate required fields based on protocol
        if (!newServerName.trim()) {
            error = "Server name is required";
            return;
        }

        if (newServerProtocol === "stdio" && !newServerCommand.trim()) {
            error = "Command is required for stdio protocol";
            return;
        }

        if (
            (newServerProtocol === "streamable" ||
                newServerProtocol === "sse") &&
            !newServerUrl.trim()
        ) {
            error = "URL is required for streamable and SSE protocols";
            return;
        }

        loading = true;
        error = "";

        try {
            const args = newServerArgs.trim()
                ? newServerArgs.split(/\s+/).filter((arg) => arg.length > 0)
                : [];

            const envs = newServerEnvs.trim()
                ? parseEnvVars(newServerEnvs)
                : undefined;

            await invoke("add_mcp_server", {
                name: newServerName.trim(),
                protocol: newServerProtocol,
                command: newServerCommand.trim() || undefined,
                args: args.length > 0 ? args : undefined,
                envs,
                url: newServerUrl.trim() || undefined,
            });

            // Reset form
            newServerName = "";
            newServerProtocol = "stdio";
            newServerCommand = "";
            newServerArgs = "";
            newServerEnvs = "";
            newServerUrl = "";
            showAddForm = false;

            // Reload servers
            await loadServers();
        } catch (err) {
            console.error("Failed to add MCP server:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    function parseEnvVars(envString: string): Record<string, string> {
        const envs: Record<string, string> = {};
        const lines = envString.split("\n").filter((line) => line.trim());

        for (const line of lines) {
            const [key, ...valueParts] = line.split("=");
            if (key && valueParts.length > 0) {
                envs[key.trim()] = valueParts.join("=").trim();
            }
        }

        return envs;
    }

    function formatEnvVars(envs: Record<string, string>): string {
        return Object.entries(envs)
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");
    }

    onMount(() => {
        loadServers();
    });
</script>

<div class="space-y-6">
    <!-- MCP Client Servers Section -->
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-3xl font-bold tracking-tight mb-2">
                MCP Client Servers
            </h2>
            <p class="text-muted-foreground">
                Manage external Model Context Protocol servers and their tools
            </p>
        </div>

        <Button
            onclick={() => (showAddForm = !showAddForm)}
            class="flex items-center gap-2"
        >
            <Plus class="w-4 h-4" />
            Add Server
        </Button>
    </div>

    {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800">{error}</p>
        </div>
    {/if}

    {#if showAddForm}
        <Card.Root>
            <Card.Header>
                <Card.Title>Add New MCP Server</Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="space-y-2">
                        <Label for="server-name">Server Name</Label>
                        <Input
                            id="server-name"
                            bind:value={newServerName}
                            placeholder="e.g., filesystem"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label for="server-protocol">Protocol</Label>
                        <Select.Root
                            type="single"
                            bind:value={newServerProtocol}
                        >
                            <Select.Trigger class="w-full"
                                >{protocolOptions.find(
                                    (option) =>
                                        option.value === newServerProtocol,
                                )?.label ?? "Select Protocol"}</Select.Trigger
                            >
                            <Select.Content>
                                {#each protocolOptions as option (option.value)}
                                    <Select.Item value={option.value}
                                        >{option.label}</Select.Item
                                    >
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>
                </div>

                {#if newServerProtocol === "stdio"}
                    <div class="space-y-2">
                        <Label for="server-command">Command</Label>
                        <Input
                            id="server-command"
                            bind:value={newServerCommand}
                            placeholder="e.g., npx"
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="server-args">Arguments</Label>
                        <Input
                            id="server-args"
                            bind:value={newServerArgs}
                            placeholder="e.g., -y @modelcontextprotocol/server-filesystem ."
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="server-envs"
                            >Environment Variables (optional)</Label
                        >
                        <Textarea
                            id="server-envs"
                            bind:value={newServerEnvs}
                            placeholder="KEY1=value1&#10;KEY2=value2"
                            rows={3}
                        />
                    </div>
                {:else}
                    <div class="space-y-2">
                        <Label for="server-url">
                            {newServerProtocol === "streamable"
                                ? "Streamable HTTP URL"
                                : "SSE URL"}
                        </Label>
                        <Input
                            id="server-url"
                            bind:value={newServerUrl}
                            placeholder={newServerProtocol === "streamable"
                                ? "e.g., http://localhost:3000/mcp"
                                : "e.g., http://localhost:3000/sse"}
                        />
                    </div>
                {/if}

                <div class="flex gap-2">
                    <Button onclick={addServer} disabled={loading}>
                        {loading ? "Adding..." : "Add Server"}
                    </Button>
                    <Button
                        variant="outline"
                        onclick={() => (showAddForm = false)}
                    >
                        Cancel
                    </Button>
                </div>
            </Card.Content>
        </Card.Root>
    {/if}

    {#if loading && servers.length === 0}
        <div class="text-center py-8">
            <p class="text-muted-foreground">Loading servers...</p>
        </div>
    {:else if servers.length === 0}
        <div class="text-center py-8">
            <p class="text-muted-foreground">No MCP servers configured</p>
        </div>
    {:else}
        <div class="grid gap-6">
            {#each servers as serverName (serverName)}
                <McpServerCard
                    {serverName}
                    bind:error
                    {loading}
                    {loadServers}
                />
            {/each}
        </div>
    {/if}

    <div class="flex justify-center pt-4">
        <Button variant="outline" onclick={loadServers} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
        </Button>
    </div>

    <div class="border-t border-gray-200 my-6"></div>
    <div class="flex flex-col gap-y-2">
        <div>
            <h2 class="text-3xl font-bold tracking-tight mb-2">Local Tools</h2>
            <p class="text-muted-foreground">Manage Loyca.ai internal tools</p>
        </div>
        <LocalToolsCard bind:error {loading} {loadServers} />
    </div>
</div>
