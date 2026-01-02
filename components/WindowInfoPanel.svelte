<script lang="ts">
    import type { AppData, WindowInfoData } from "$lib/types";
    import { invoke } from "@tauri-apps/api/core";
    import { onMount, onDestroy } from "svelte";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select/index.js";
    import Button from "$lib/components/ui/button/button.svelte";
    import {
        ChevronDown,
        ChevronRight,
        Clock,
        Tag,
        Image,
        RefreshCw,
        AppWindowIcon,
        Binoculars,
    } from "lucide-svelte";
    import Label from "./ui/label/label.svelte";
    import { createAutoRefresh } from "$lib/utils/auto-refresh";
    import AutoRefresh from "./AutoRefresh.svelte";
    import X from "@lucide/svelte/icons/x";

    let apps = $state<AppData[]>([]);
    let selectedApp = $state<AppData | null>(null);
    let windowInfo = $state<WindowInfoData[]>([]);
    let loading = $state(false);
    let error = $state("");
    let expandedWindows = $state<Set<number>>(new Set());
    let windowLimit = $state(10);
    let showAllApps = $state(false);

    // Modal state for screenshot zoom
    let showImageModal = $state(false);
    let modalImageSrc = $state("");

    // Auto-refresh and time filtering
    let refreshInterval = $state(10); // seconds
    let autoRefresh = $state(false);
    let timeRangeValue = $state("Last Hour");
    let timeRange = $state(1);

    const timeRangeOptions = [
        { value: 1, label: "Last Hour" },
        { value: 6, label: "Last 6 Hours" },
        { value: 12, label: "Last 12 Hours" },
        { value: 24, label: "Last 24 Hours" },
    ];

    let autoRefreshManager: ReturnType<typeof createAutoRefresh>;

    $effect(() => {
        if (!autoRefreshManager) {
            autoRefreshManager = createAutoRefresh({
                enabled: true,
                intervalSeconds: refreshInterval,
                onRefresh: refreshApps,
            });
        }
    });

    $effect(() => {
        if (autoRefresh) {
            autoRefreshManager.start();
        } else {
            autoRefreshManager.stop();
        }
    });

    async function loadApps() {
        try {
            loading = true;
            error = "";
            apps = await invoke<AppData[]>("get_apps_by_time_range", {
                hours: timeRange,
            });

            apps.sort(
                (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
            );
            apps = apps.filter(
                (app1, i, arr) =>
                    arr.findIndex(
                        (app2) => app1.process_name === app2.process_name,
                    ) === i &&
                    Date.parse(app1.updated_at) >
                        Date.now() - timeRange * 60 * 60 * 1000,
            );
        } catch (err) {
            console.error("Failed to load apps:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            loading = false;
        }
    }

    async function loadWindowInfo(app: AppData) {
        try {
            loading = true;
            error = "";
            selectedApp = app;
            windowInfo = await invoke<WindowInfoData[]>(
                "get_window_info_by_pid_and_time",
                {
                    pid: app.pid,
                    limit: windowLimit,
                    hours: timeRange,
                },
            );
        } catch (err) {
            console.error("Failed to load window info:", err);
            error = err instanceof Error ? err.message : String(err);
            windowInfo = [];
        } finally {
            loading = false;
        }
    }

    async function refreshApps() {
        await loadApps();
        if (selectedApp) {
            await loadWindowInfo(selectedApp);
        }
    }

    $effect(() => {
        if (timeRangeValue) {
            timeRange =
                timeRangeOptions.find(
                    (option) => option.label === timeRangeValue,
                )?.value ?? 24;
            refreshApps();
        }
    });

    function loadMoreWindows() {
        windowLimit += 10;
        if (selectedApp) {
            loadWindowInfo(selectedApp);
        }
    }

    function toggleWindowExpanded(index: number) {
        if (expandedWindows.has(index)) {
            expandedWindows.delete(index);
        } else {
            expandedWindows.add(index);
        }
        expandedWindows = new Set(expandedWindows);
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString();
    }

    function formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    function openImageModal(imageSrc: string) {
        modalImageSrc = imageSrc;
        showImageModal = true;
    }

    function closeImageModal() {
        showImageModal = false;
        modalImageSrc = "";
    }

    function handleImageKeydown(event: KeyboardEvent, imageSrc: string) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openImageModal(imageSrc);
        }
    }

    function handleModalKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeImageModal();
        }
    }

    onMount(() => {
        loadApps();
    });
</script>

<div class="max-w-6xl mx-auto space-y-8">
    <div>
        <div class="relativeflex items-center justify-between mb-2">
            <h2 class="text-3xl font-bold tracking-tight mb-2">
                Window Activity Tracker
            </h2>
            <p class="text-muted-foreground">
                Monitor application usage and window activity across your
                system.
            </p>
            <AutoRefresh {refreshInterval} bind:autoRefresh />
        </div>
        <!-- Controls Section -->
        <Card.Root class="pl-2 py-0 text-center w-full shadow-none border-none">
            <div class="flex items-center gap-2">
                <Label for="timeRange" class="text-sm font-bold"
                    >Time Range:</Label
                >
                <Select.Root type="single" bind:value={timeRangeValue}>
                    <Select.Trigger class="w-[180px]"
                        >{timeRangeValue}</Select.Trigger
                    >
                    <Select.Content>
                        {#each timeRangeOptions as option (option.value)}
                            <Select.Item value={option.label}
                                >{option.label}</Select.Item
                            >
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>
        </Card.Root>
    </div>

    {#if error}
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-700 font-medium">Error</p>
            <p class="text-red-600 text-sm">{error}</p>
        </div>
    {/if}

    <!-- App Selection -->
    <div class="flex flex-col lg:flex-row gap-4">
        <div
            class="flex-1 max-w-full lg:max-w-1/3 bg-white border border-gray-200 rounded-lg p-6"
        >
            <div class="flex flex-row justify-around">
                <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AppWindowIcon class="w-5 h-5" />
                    Applications
                </h3>
                <Button
                    variant="outline"
                    size="none"
                    class="h-8 w-28"
                    onclick={() => (showAllApps = !showAllApps)}
                >
                    {showAllApps ? "Show Top 10" : "Show All"}
                </Button>
            </div>

            {#if loading && apps.length === 0}
                <div class="flex items-center justify-center py-8">
                    <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                    ></div>
                </div>
            {:else if apps.length === 0}
                <p class="text-muted-foreground">
                    No applications found in the database.
                </p>
            {:else}
                <!-- Status Indicator -->
                <div class="bg-white border rounded-lg p-3 mb-2">
                    <div
                        class="flex items-center justify-between text-sm gap-x-4"
                    >
                        <span class="text-muted-foreground">
                            Showing {showAllApps
                                ? apps.length
                                : Math.min(apps.length, 10)} of
                            {apps.length} applications
                        </span>
                        <span class="text-muted-foreground">
                            Time range: {timeRangeOptions.find(
                                (opt) => opt.value === timeRange,
                            )?.label || "Custom"}
                        </span>
                    </div>
                </div>
                <div
                    class="flex flex-col gap-2 max-h-80 lg:max-h-full overflow-y-auto"
                >
                    {#each showAllApps ? apps : apps.slice(0, 10) as app (app.pid)}
                        <button
                            class="text-left relative border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onclick={() => loadWindowInfo(app)}
                        >
                            <div
                                class="flex items-center justify-between group"
                            >
                                <div class="flex-1">
                                    <h4 class="font-medium">
                                        {app.process_name}
                                    </h4>
                                    <div
                                        class="text-sm text-muted-foreground mt-1"
                                    >
                                        <span>PID: {app.pid}</span>
                                        {#if app.total_focus_time}
                                            <span class="mx-2">•</span>
                                            <span
                                                >Total: {formatDuration(
                                                    app.total_focus_time,
                                                )}</span
                                            >
                                        {/if}
                                    </div>
                                    <div
                                        class="text-xs text-muted-foreground mt-1"
                                    >
                                        Last updated: {formatDate(
                                            app.updated_at,
                                        )}
                                    </div>
                                </div>

                                <Binoculars
                                    class="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                                />
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Window Information -->
        <div
            class="max-w-full lg:w-2/3 bg-white border border-gray-200 rounded-lg p-6"
        >
            {#if selectedApp}
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3
                            class="text-lg font-semibold flex items-center gap-2"
                        >
                            <Image class="w-5 h-5" />
                            Windows for {selectedApp.process_name} (PID: {selectedApp.pid})
                        </h3>
                        <p class="text-sm text-muted-foreground">
                            Showing activity from {timeRangeOptions
                                .find((opt) => opt.value === timeRange)
                                ?.label?.toLowerCase() || "selected time range"}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() =>
                            selectedApp && loadWindowInfo(selectedApp)}
                        disabled={loading}
                        class="flex items-center gap-2"
                    >
                        <RefreshCw class="w-4 h-4" />
                        Refresh
                    </Button>
                </div>

                {#if loading && windowInfo.length === 0}
                    <div class="flex items-center justify-center py-8">
                        <div
                            class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                        ></div>
                    </div>
                {:else if windowInfo.length === 0}
                    <p class="text-muted-foreground">
                        No window information found for this application.
                    </p>
                {:else}
                    <!-- Window Stats -->
                    <div class="bg-gray-50 rounded-lg p-3 mb-4">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-4 text-sm">
                                <span class="text-muted-foreground">
                                    {windowInfo.length} window{windowInfo.length !==
                                    1
                                        ? "s"
                                        : ""} found
                                </span>
                                {#if windowInfo.length > 0}
                                    <span class="text-muted-foreground">
                                        Latest: {formatDate(
                                            windowInfo[0].created_at,
                                        )}
                                    </span>
                                    {#if windowInfo.length > 1}
                                        <span class="text-muted-foreground">
                                            Oldest: {formatDate(
                                                windowInfo[
                                                    windowInfo.length - 1
                                                ].created_at,
                                            )}
                                        </span>
                                    {/if}
                                {/if}
                            </div>
                            {#if windowInfo.length >= windowLimit}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={loadMoreWindows}
                                    disabled={loading}
                                >
                                    Load More
                                </Button>
                            {/if}
                        </div>
                    </div>
                    <div class="space-y-4">
                        {#each windowInfo as window, index (window.created_at)}
                            <div
                                class="border border-gray-200 rounded-lg overflow-hidden"
                            >
                                <button
                                    class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                                    onclick={() => toggleWindowExpanded(index)}
                                >
                                    <div class="flex-1">
                                        <div class="font-medium">
                                            {window.title}
                                        </div>
                                        <div
                                            class="text-sm text-muted-foreground mt-1 flex items-center gap-4"
                                        >
                                            <span
                                                class="flex items-center gap-1"
                                            >
                                                <Clock class="w-3 h-3" />
                                                {formatDate(window.created_at)}
                                            </span>
                                            <span
                                                class="flex items-center gap-1"
                                            >
                                                <Tag class="w-3 h-3" />
                                                {window.llm_category}
                                            </span>
                                        </div>
                                    </div>
                                    {#if expandedWindows.has(index)}
                                        <ChevronDown class="w-5 h-5" />
                                    {:else}
                                        <ChevronRight class="w-5 h-5" />
                                    {/if}
                                </button>

                                {#if expandedWindows.has(index)}
                                    <div
                                        class="px-4 pb-4 border-t border-gray-100"
                                    >
                                        <div
                                            class="grid md:grid-cols-2 gap-6 mt-4"
                                        >
                                            <!-- Screenshot -->
                                            <div class="relative">
                                                <h4 class="font-medium my-2">
                                                    Screenshot
                                                </h4>
                                                {#if window.screenshot_url}
                                                    <div
                                                        class="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                                        role="button"
                                                        tabindex="0"
                                                        aria-label="Click to zoom screenshot"
                                                        onclick={() =>
                                                            openImageModal(
                                                                window.screenshot_url,
                                                            )}
                                                        onkeydown={(e) =>
                                                            handleImageKeydown(
                                                                e,
                                                                window.screenshot_url,
                                                            )}
                                                    >
                                                        <img
                                                            src={window.screenshot_url}
                                                            alt="Window screenshot for {window.title}"
                                                            class="w-full h-auto max-h-64 object-contain bg-gray-50 hover:opacity-90 transition-opacity"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                {:else}
                                                    <div
                                                        class="border border-gray-200 rounded-lg p-8 text-center text-muted-foreground bg-gray-50"
                                                    >
                                                        <Image
                                                            class="w-8 h-8 mx-auto mb-2 opacity-50"
                                                        />
                                                        No screenshot available
                                                    </div>
                                                {/if}
                                            </div>

                                            <!-- Details -->
                                            <div class="space-y-4">
                                                <div>
                                                    <div>
                                                        <h4
                                                            class="font-medium mt-12 mb-2"
                                                        >
                                                            Keywords
                                                        </h4>
                                                        <div
                                                            class="flex flex-wrap gap-1"
                                                        >
                                                            {#each (window.llm_keywords || "")
                                                                .split(",")
                                                                .filter( (k) => k.trim(), ) as keyword}
                                                                <span
                                                                    class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                                                                >
                                                                    {keyword.trim()}
                                                                </span>
                                                            {:else}
                                                                <span
                                                                    class="text-sm text-muted-foreground"
                                                                    >No keywords</span
                                                                >
                                                            {/each}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <h4 class="font-medium my-2">
                                            Description
                                        </h4>
                                        <p
                                            class="text-sm text-gray-700 bg-gray-50 p-3 rounded border"
                                        >
                                            {window.llm_description ||
                                                "No description available"}
                                        </p>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else}
                <Card.Root class="p-8 text-center border-none shadow-none">
                    <div
                        class="flex flex-row font-medium mx-auto text-muted-foreground"
                    >
                        <AppWindowIcon class="w-24 h-24" />
                        <span class="ml-2 text-8xl">?</span>
                    </div>
                    <h4 class="text-lg font-semibold mb-2">
                        No Application Selected
                    </h4>
                    <p class="text-muted-foreground">
                        Select an application to view its information.
                    </p>
                </Card.Root>
            {/if}
        </div>
    </div>
</div>

<!-- Image Zoom Modal -->
{#if showImageModal}
    <div
        class="fixed inset-0 bg-primary/50 bg-opacity-75 flex items-center justify-center z-50"
        role="dialog"
        aria-label="Screenshot zoom modal"
        tabindex="-1"
        onclick={closeImageModal}
        onkeydown={handleModalKeydown}
    >
        <div class="relative max-w-[90vw] max-h-[90vh] p-4">
            <Button
                variant="destructive"
                size="icon"
                class="absolute top-2 right-2"
                onclick={closeImageModal}
            >
                <X />
            </Button>
            <div
                role="button"
                tabindex="0"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
            >
                <img
                    src={modalImageSrc}
                    alt="Screenshot (zoomed)"
                    class="max-w-full max-h-full object-contain rounded-lg"
                />
            </div>
        </div>
    </div>
{/if}
