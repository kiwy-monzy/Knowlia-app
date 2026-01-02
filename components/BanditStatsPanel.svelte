<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { BanditStat } from "$lib/types";
    import Button from "$lib/components/ui/button/button.svelte";
    import * as Card from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select/index.js";
    import { createAutoRefresh } from "$lib/utils/auto-refresh";
    import { TrendingUp, Target, Brain } from "lucide-svelte";
    import { LineChart } from "layerchart";
    import { scaleUtc, scalePoint } from "d3-scale";
    import { curveStep } from "d3-shape";
    import * as Chart from "$lib/components/ui/chart/index.js";
    import AutoRefresh from "./AutoRefresh.svelte";

    let banditStats = $state<BanditStat[]>([]);
    let isLoading = $state(false);
    let error = $state<string>("");

    // Auto-refresh functionality
    let autoRefresh = $state(false);
    let refreshInterval = $state(30);

    let autoRefreshManager: ReturnType<typeof createAutoRefresh>;

    $effect(() => {
        if (!autoRefreshManager) {
            autoRefreshManager = createAutoRefresh({
                enabled: true,
                intervalSeconds: refreshInterval,
                onRefresh: loadBanditStats,
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

    // Computed statistics
    let totalStats = $derived(banditStats.length);
    let avgReward = $derived(
        totalStats > 0
            ? banditStats.reduce((sum, stat) => sum + stat.reward, 0) /
                  totalStats
            : 0,
    );
    let assistRate = $derived(
        totalStats > 0
            ? (banditStats.filter((stat) => stat.to_assist).length /
                  totalStats) *
                  100
            : 0,
    );
    let userStates = $derived(
        Array.from(new Set(banditStats.map((stat) => stat.user_state))),
    );

    // Define state order (controls vertical position in the chart)
    const stateOrder = [
        "flowing",
        "struggling",
        "idle",
        "focused",
        "learning",
        "communicating",
        "entertaining",
    ];

    // Chart data for user state fluctuations
    let chartData = $derived(
        banditStats
            .filter(
                (stat) =>
                    Date.now() - new Date(stat.created_at).getTime() <
                    24 * 60 * 60 * 1000,
            ) // from today
            .map((stat, index) => ({
                date: new Date(stat.created_at),
                state: stat.user_state,
                reward: stat.reward,
                user_action: stat.user_action,
                stateIndex: Math.max(0, stateOrder.indexOf(stat.user_state)),
                index: index,
            })),
    );

    const chartConfig = {
        state: {
            label: "User State",
            color: "var(--chart-1)",
        },
    } satisfies Chart.ChartConfig;

    async function loadBanditStats() {
        isLoading = true;
        error = "";
        try {
            banditStats = await invoke<BanditStat[]>("get_bandit_stats");
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            console.error("Failed to load bandit stats:", err);
        } finally {
            isLoading = false;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString();
    }

    function getActionColor(action: string): string {
        switch (action.toLowerCase()) {
            case "accept":
                return "text-green-600 bg-green-50";
            case "dismiss":
                return "text-red-600 bg-red-50";
            case "omit":
                return "text-gray-600 bg-gray-50";
            default:
                return "text-blue-600 bg-blue-50";
        }
    }

    function getRewardColor(reward: number): string {
        if (reward > 0.5) return "text-green-600";
        if (reward > 0) return "text-yellow-600";
        return "text-red-600";
    }

    onMount(() => {
        loadBanditStats();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-3xl font-bold tracking-tight mb-2">
                Assistant Statistics
            </h2>
            <p class="text-muted-foreground">
                Performance metrics and history of the assistant (contextual
                bandit)
            </p>
            <AutoRefresh {refreshInterval} bind:autoRefresh />
        </div>
    </div>

    {#if error}
        <div class="p-4 rounded-lg bg-red-50 border border-red-200">
            <p class="text-red-800 font-medium">
                Error loading bandit statistics
            </p>
            <p class="text-red-600 text-sm mt-1">{error}</p>
        </div>
    {/if}

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card.Root class="p-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-100 rounded-lg">
                    <Target class="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <p class="text-sm text-muted-foreground">Total Decisions</p>
                    <p class="text-2xl font-bold">{totalStats}</p>
                </div>
            </div>
        </Card.Root>

        <Card.Root class="p-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-green-100 rounded-lg">
                    <TrendingUp class="w-5 h-5 text-green-600" />
                </div>
                <div>
                    <p class="text-sm text-muted-foreground">Avg Reward</p>
                    <p class="text-2xl font-bold">{avgReward.toFixed(3)}</p>
                </div>
            </div>
        </Card.Root>

        <Card.Root class="p-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-purple-100 rounded-lg">
                    <Brain class="w-5 h-5 text-purple-600" />
                </div>
                <div>
                    <p class="text-sm text-muted-foreground">Assist Rate</p>
                    <p class="text-2xl font-bold">{assistRate.toFixed(1)}%</p>
                </div>
            </div>
        </Card.Root>

        <Card.Root class="p-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-orange-100 rounded-lg">
                    <Target class="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <p class="text-sm text-muted-foreground">User States</p>
                    <p class="text-2xl font-bold">{userStates.length}</p>
                </div>
            </div>
        </Card.Root>
    </div>

    <!-- User State Fluctuation Chart -->
    {#if chartData.length > 0}
        <Card.Root>
            <Card.Header>
                <Card.Title>User State Fluctuations</Card.Title>
                <Card.Description
                    >How the user state has changed over time (24 hours)</Card.Description
                >
            </Card.Header>
            <Card.Content>
                <Chart.Container class="ml-20" config={chartConfig}>
                    <LineChart
                        points={{ r: 4 }}
                        data={chartData}
                        x="date"
                        y="stateIndex"
                        xScale={scaleUtc()}
                        series={[
                            {
                                key: "stateIndex",
                                label: "User State",
                                color: chartConfig.state.color,
                            },
                        ]}
                        props={{
                            spline: {
                                curve: curveStep,
                                motion: "tween",
                                strokeWidth: 2,
                            },
                            highlight: {
                                points: { motion: "none", r: 6 },
                            },
                            xAxis: {
                                label: "Date",
                            },
                            yAxis: {
                                format: (v: number) => stateOrder[v] || "",
                                label: "State",
                                ticks: stateOrder.length,
                            },
                        }}
                    >
                        {#snippet tooltip()}
                            <Chart.Tooltip hideLabel>
                                {#snippet formatter({ item })}
                                    {@const stat =
                                        chartData[item.payload.index]}
                                    {#if stat}
                                        <div class="flex flex-col space-y-2">
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                {stat.date.toLocaleTimeString()}

                                                <span
                                                    class="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                                                >
                                                    {stat.state}
                                                </span>
                                            </div>
                                            <div class="space-y-1">
                                                <div
                                                    class="flex justify-between gap-4"
                                                >
                                                    <span
                                                        class="text-muted-foreground"
                                                        >User Action:</span
                                                    >
                                                    <span
                                                        class="px-2 py-1 rounded-full text-xs font-medium {getActionColor(
                                                            stat.user_action,
                                                        )}"
                                                    >
                                                        {stat.user_action}
                                                    </span>
                                                </div>
                                                <div
                                                    class="flex justify-between gap-4"
                                                >
                                                    <span
                                                        class="text-muted-foreground"
                                                        >Reward:</span
                                                    >
                                                    <span
                                                        class="font-mono text-sm {getRewardColor(
                                                            stat.reward,
                                                        )}"
                                                    >
                                                        {stat.reward.toFixed(3)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    {/if}
                                {/snippet}
                            </Chart.Tooltip>
                        {/snippet}
                    </LineChart>
                </Chart.Container>
            </Card.Content>
        </Card.Root>
    {/if}

    <!-- Statistics Table -->
    {#if totalStats > 0}
        <Card.Root class="p-6">
            <h4 class="text-lg font-semibold mb-4">Decision History</h4>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left p-3 font-medium">Timestamp</th>
                            <th class="text-left p-3 font-medium">User State</th
                            >
                            <th class="text-left p-3 font-medium">Decision</th>
                            <th class="text-left p-3 font-medium"
                                >User Action</th
                            >
                            <th class="text-left p-3 font-medium">Reward</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each banditStats.slice(0, 50) as stat}
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3 text-xs text-muted-foreground">
                                    {formatDate(stat.created_at)}
                                </td>
                                <td class="p-3">
                                    <span
                                        class="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                                    >
                                        {stat.user_state}
                                    </span>
                                </td>
                                <td class="p-3">
                                    <span
                                        class="px-2 py-1 rounded-full text-xs font-medium {stat.to_assist
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-gray-50 text-gray-700'}"
                                    >
                                        {stat.to_assist
                                            ? "Assist"
                                            : "No Assist"}
                                    </span>
                                </td>
                                <td class="p-3">
                                    <span
                                        class="px-2 py-1 rounded-full text-xs font-medium {getActionColor(
                                            stat.user_action,
                                        )}"
                                    >
                                        {stat.user_action}
                                    </span>
                                </td>
                                <td
                                    class="p-3 font-mono text-sm {getRewardColor(
                                        stat.reward,
                                    )}"
                                >
                                    {stat.reward.toFixed(3)}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
                {#if banditStats.length > 50}
                    <p class="text-center text-muted-foreground text-sm mt-4">
                        Showing latest 50 entries out of {totalStats} total
                    </p>
                {/if}
            </div>
        </Card.Root>
    {:else if !isLoading}
        <Card.Root class="p-8 text-center">
            <Brain class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 class="text-lg font-semibold mb-2">No Statistics Available</h4>
            <p class="text-muted-foreground">
                The assistant hasn't made any decisions yet. Statistics will
                appear here once the bandit starts making decisions.
            </p>
        </Card.Root>
    {/if}
</div>
