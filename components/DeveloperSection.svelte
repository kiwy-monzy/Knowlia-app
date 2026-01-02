<script lang="ts">
    import { getAllWindows, Window } from "@tauri-apps/api/window";
    import { invoke } from "@tauri-apps/api/core";
    import Button from "$lib/components/ui/button/button.svelte";
    import Switch from "$lib/components/ui/switch/switch.svelte";
    import ActionPanel from "$lib/components/ActionPanel.svelte";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import { onMount } from "svelte";
    import { Bird, Folder, RotateCcw } from "lucide-svelte";
    import Label from "./ui/label/label.svelte";
    import Input from "./ui/input/input.svelte";
    import { openPath } from "@tauri-apps/plugin-opener";
    import { globalConfig } from "$lib/stores/globalConfig.svelte";

    let error = $state<string>("");
    let avatarWindow: Window | null = $state(null);
    let avatarWindowDecorations = $state(false);
    let showRestartDialog = $state(false);
    let isRestarting = $state(false);
    let userStateInput = $state("");
    let userIntentionInput = $state("");
    let appDescriptionInput = $state("");
    let isGeneratingFakeSuggestion = $state(false);
    let isAvatarRestarting = $state(false);

    $effect(() => {
        if (avatarWindow) {
            avatarWindow.setDecorations(avatarWindowDecorations);
        }
    });

    async function handleRestartBandit() {
        isRestarting = true;
        try {
            await invoke("restart_contextual_bandit");
            showRestartDialog = false;
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            console.error("Failed to restart bandit:", err);
        } finally {
            isRestarting = false;
        }
    }

    async function handleGenerateFakeSuggestion() {
        if (!userStateInput.trim() || !userIntentionInput.trim()) {
            error = "Both userState and userIntention are required";
            return;
        }

        isGeneratingFakeSuggestion = true;
        error = "";

        try {
            const result = await invoke("generate_fake_suggestion", {
                userState: userStateInput,
                userIntention: userIntentionInput,
                appDescription: appDescriptionInput,
            });
        } catch (err) {
            console.error("Failed to generate fake suggestion:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isGeneratingFakeSuggestion = false;
        }
    }

    async function handleRestartAvatar() {
        isAvatarRestarting = true;
        invoke("close_avatar_window").then(() =>
            setTimeout(
                () =>
                    invoke("create_avatar_window").then(
                        () => (isAvatarRestarting = false),
                    ),
                1000,
            ),
        );
    }

    onMount(async () => {
        const windows = await getAllWindows();
        avatarWindow =
            windows.find((window) => window.label === "avatar") ?? null;
        avatarWindowDecorations = (await avatarWindow?.isDecorated()) ?? false;
    });
</script>

<div class="max-w-4xl mx-auto space-y-4">
    <div class="flex items-center gap-4">
        <h2 class="text-3xl font-bold tracking-tight">Testing</h2>
        <p class="text-muted-foreground">Test Loyca.AI logic</p>
    </div>

    <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-start">
        <div class="space-y-6">
            <ActionPanel bind:error />
        </div>

        <div class="lg:mt-8">
            <!-- Generate Fake Suggestion -->
            <div class="p-4 rounded-lg border bg-white space-y-4">
                <div class="space-y-1">
                    <h4 class="text-sm font-medium">
                        Generate Fake Suggestion
                    </h4>
                    <p class="text-sm text-muted-foreground">
                        Test the suggestion generator with custom state and user
                        intention
                    </p>
                </div>
                <div class="space-y-3">
                    <div class="space-y-2">
                        <Label for="user-state">User State</Label>
                        <Input
                            id="user-state"
                            bind:value={userStateInput}
                            placeholder="e.g., focused"
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="user-intention">User Intent</Label>
                        <Input
                            id="user-intention"
                            bind:value={userIntentionInput}
                            placeholder="e.g., Creating a web page"
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="user-screenshot"
                            >Screenshot description</Label
                        >
                        <Input
                            id="user-screenshot"
                            bind:value={appDescriptionInput}
                            placeholder="e.g., A screenshot of a web page"
                        />
                    </div>
                    <Button
                        onclick={handleGenerateFakeSuggestion}
                        disabled={isGeneratingFakeSuggestion ||
                            !userStateInput.trim() ||
                            !userIntentionInput.trim()}
                        class="w-full"
                    >
                        {isGeneratingFakeSuggestion
                            ? "Generating..."
                            : "Generate Fake Suggestion"}
                    </Button>
                </div>
            </div>
        </div>
        <img
            src="/loyca/surprised_big.png"
            alt="logo"
            class="fixed -right-2 -bottom-32 pointer-events-none w-64 opacity-20 overflow-hidden -z-1"
        />
    </div>

    <!-- Horizontal line separator -->
    <hr class="border-t border-border" />

    <!-- Controls section at the bottom -->
    <div class="max-w-2xl mx-auto space-y-2 z-30">
        <h3 class="text-xl font-semibold">Controls</h3>

        <!-- Avatar decoration switch -->
        <div
            class="flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
        >
            <div class="space-y-1">
                <h4 class="text-sm font-medium">Avatar Window Decorations</h4>
                <p class="text-sm text-muted-foreground">
                    Toggle window decorations for the avatar window
                </p>
            </div>
            <Switch bind:checked={avatarWindowDecorations} />
        </div>
        <!-- Open App folder -->
        <div
            class="flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
        >
            <div class="space-y-1">
                <h4 class="text-sm font-medium">Open Loyca.ai folder</h4>
                <p class="text-sm text-muted-foreground">
                    Open the Loyca.ai folder in the file explorer
                </p>
            </div>
            <Button
                variant="outline"
                onclick={() => openPath(globalConfig.app_path)}
                class="w-36"
            >
                <Folder class="w-4 h-4 mr-2" />
                Open Folder
            </Button>
        </div>
        <!-- Restart bandit button -->
        <div
            class="z-30 flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
        >
            <div class="space-y-1">
                <h4 class="text-sm font-medium">Contextual Bandit</h4>
                <p class="text-sm text-muted-foreground">
                    Reset the bandit model and clear all statistics
                </p>
            </div>
            <Button
                variant="destructive"
                onclick={() => (showRestartDialog = true)}
                disabled={isRestarting}
                class="w-36"
            >
                <RotateCcw class="w-4 h-4" />
                {isRestarting ? "Restarting..." : "Restart Bandit"}
            </Button>
        </div>

        <!-- Restart bandit confirmation modal -->
        <AlertModal
            bind:open={showRestartDialog}
            title="Restart Contextual Bandit"
            description="This will permanently delete all bandit statistics and the trained model. A new model will be initialized from scratch. This action cannot be undone."
            onConfirm={handleRestartBandit}
            buttonLabel="Restart"
            onOpenChange={(open) => (showRestartDialog = open)}
        />

        <!-- Restart avatar window -->
        <div
            class="z-30 flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
        >
            <div class="space-y-1">
                <h4 class="text-sm font-medium">Restart Avatar</h4>
                <p class="text-sm text-muted-foreground">
                    Reload the avatar display
                </p>
            </div>
            <Button
                variant="default"
                disabled={isAvatarRestarting}
                onclick={() => handleRestartAvatar()}
                class="w-36"
            >
                <Bird class="w-4 h-4" />
                Restart Avatar
            </Button>
        </div>
    </div>
</div>
