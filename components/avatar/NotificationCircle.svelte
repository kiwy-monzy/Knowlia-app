<script lang="ts">
    import { fade, scale } from "svelte/transition";
    import { elasticOut } from "svelte/easing";
    import { Bell, ThumbsUp, ThumbsDown } from "lucide-svelte";

    let TIME_LIMIT = 20;

    let { notification = null, handleNotification } = $props<{
        notification: {
            id: string;
            fromTest: boolean;
        } | null;
        handleNotification: (action: string) => void;
    }>();

    let timeLeft = $state(TIME_LIMIT);
    let isExpanded = $state(false);
    let timeoutId: number | null = null;
    let countdownId: number | null = null;
    let shouldPulse = $state(false);

    const triggerPulse = () => {
        shouldPulse = !shouldPulse;
    };

    $effect(() => {
        if (notification) {
            // Reset state for new notification
            timeLeft = TIME_LIMIT;
            isExpanded = false;

            // Clear any existing timers
            if (timeoutId) clearTimeout(timeoutId);
            if (countdownId) clearInterval(countdownId);

            // Start countdown
            countdownId = setInterval(() => {
                timeLeft--;
                triggerPulse();
                if (timeLeft <= 0) {
                    handleOmit();
                }
            }, 1000);

            // Auto-omit after TIME_LIMIT seconds
            timeoutId = setTimeout(() => {
                handleOmit();
            }, TIME_LIMIT * 1000);
        } else {
            // Clear timers when notification is null
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (countdownId) {
                clearInterval(countdownId);
                countdownId = null;
            }
        }
    });

    const handleAccept = () => {
        handleNotification("accept");
        cleanup();
    };

    const handleReject = () => {
        handleNotification("reject");
        cleanup();
    };

    const handleOmit = () => {
        handleNotification("omit");
        cleanup();
    };

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (countdownId) {
            clearInterval(countdownId);
            countdownId = null;
        }
    };

    const toggleExpanded = () => {
        isExpanded = !isExpanded;
    };
</script>

{#if notification}
    {#key shouldPulse}
        <div
            class="flex items-center justify-center absolute top-2 right-2 z-100 w-28 h-32"
            role="button"
            tabindex="0"
            onmouseleave={() => (isExpanded = false)}
            onmouseenter={toggleExpanded}
            data-tauri-drag-region
        >
            <!-- Pulsing notification indicator -->
            <div
                class="ml-8 w-10 h-10 bg-yellow-500 rounded-full cursor-pointer shadow-lg"
                transition:scale={{ duration: 400, easing: elasticOut }}
            >
                <button
                    class="w-10 h-10 bg-white/90 rounded-sm border-2 border-yellow-500 flex items-center justify-center text-center"
                >
                    <span
                        class="ml-1 text-4xl font-tiny5 font-bold text-yellow-500"
                        >{timeLeft}</span
                    >
                </button>
            </div>

            <!-- Expanded notification panel -->
            {#if isExpanded}
                <div
                    class="absolute top-20 rounded-lg"
                    transition:scale={{ duration: 800, easing: elasticOut }}
                >
                    <!-- Action buttons -->
                    <div class="ml-8 flex gap-2">
                        <button
                            class="flex-1 flex items-center justify-center gap-1 p-1 bg-green-500 rounded-md hover:bg-green-600 transition-colors text-white cursor-pointer"
                            onclick={handleAccept}
                        >
                            <ThumbsUp class="size-7" />
                        </button>

                        <button
                            class="flex-1 flex items-center justify-center gap-1 px-1 bg-red-500 rounded-md hover:bg-red-600 transition-colors text-white cursor-pointer"
                            onclick={handleReject}
                        >
                            <ThumbsDown class="size-7" />
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    {/key}
{/if}
