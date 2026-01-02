<script lang="ts">
    import { PlayIcon, PauseIcon } from "lucide-svelte";
    import Button from "./ui/button/button.svelte";
    import { onMount } from "svelte";

    let { autoRefresh = $bindable(), refreshInterval } = $props<{
        autoRefresh: boolean;
        refreshInterval: number;
    }>();

    let countdown = $state(refreshInterval);
    let intervalId: number | undefined;

    function startCountdown() {
        countdown = refreshInterval;
        if (intervalId) clearInterval(intervalId);

        intervalId = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                countdown = refreshInterval;
            }
        }, 1000);
    }

    function stopCountdown() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
    }

    $effect(() => {
        if (autoRefresh) {
            startCountdown();
        } else {
            stopCountdown();
        }
    });

    onMount(() => {
        return () => stopCountdown();
    });
</script>

{#if autoRefresh}
    <div class="flex items-center gap-1 text-green-600">
        <Button
            variant="ghost"
            size="icon"
            onclick={() => (autoRefresh = false)}
        >
            <PauseIcon class="w-4 h-4 text-primary" />
        </Button>
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span class="text-xs">
            Refresh in {countdown}s
        </span>
    </div>
{:else}
    <div class="flex items-center gap-1 text-red-600">
        <Button
            variant="ghost"
            size="icon"
            onclick={() => (autoRefresh = true)}
        >
            <PlayIcon class="w-4 h-4 text-primary" />
        </Button>
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
        <span class="text-xs"> Auto-refresh disabled </span>
    </div>
{/if}
