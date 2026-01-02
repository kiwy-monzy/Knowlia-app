<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Focus, SendHorizontalIcon, Square, Terminal } from "lucide-svelte";
    import { slide } from "svelte/transition";

    let {
        customPrompt = $bindable(),
        withScreenshotsContext = $bindable(),
        isProcessing,
        onSend,
        onStop,
    } = $props<{
        customPrompt: string;
        withScreenshotsContext: boolean;
        isProcessing: boolean;
        onSend: () => void;
        onStop: () => void;
    }>();
</script>

<div
    class="absolute bottom-12 right-[110px] min-w-[360px] max-w-[500px]"
    transition:slide={{ axis: "x" }}
>
    <form class="flex flex-rows w-full items-center gap-1.5">
        <Textarea
            disabled={isProcessing}
            id="prompt"
            placeholder="Say something..."
            bind:value={customPrompt}
            class="bg-white resize-none"
            onkeydown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && customPrompt.trim()) {
                    e.preventDefault();
                    onSend();
                }
                if (e.key === "Enter" && customPrompt === "\n") {
                    customPrompt = "";
                    e.preventDefault();
                }
            }}
        />

        <Button
            variant="ghost"
            size="none"
            disabled={isProcessing}
            onclick={() => (withScreenshotsContext = !withScreenshotsContext)}
            class="absolute right-11 bottom-0 z-1 size-6"
        >
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <Focus
                            class={`h-4 w-4 ${withScreenshotsContext ? "text-red-600/80 animate-pulse" : "text-gray-600"}`}
                        />
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        <p class="text-xs">
                            {#if withScreenshotsContext}
                                Include user's activity in the message
                            {:else}
                                No activity context is included
                            {/if}
                        </p>
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
        </Button>

        {#if isProcessing}
            <Button
                size="none"
                variant="destructive"
                onclick={() => onStop()}
                class="h-16 w-8 z-1"
            >
                <Square class="h-4 w-4" />
            </Button>
        {:else}
            <Button
                type="submit"
                size="none"
                onclick={() => onSend()}
                disabled={isProcessing || !customPrompt.trim()}
                class="border border-gray-500/50 hover:bg-gray-500/50 h-16 w-8 z-1"
            >
                <SendHorizontalIcon class="h-4 w-4" />
            </Button>
        {/if}
    </form>
</div>
