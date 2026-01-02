<script lang="ts">
    import { Bot, BotOff } from "lucide-svelte";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";

    let { isAssistantEnabled }: { isAssistantEnabled: boolean } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            <div class="-ml-2 flex items-center gap-1 z-30">
                {#if isAssistantEnabled}
                    <div
                        class="ml-1 mt-1 absolute w-3 h-2.5 bg-green-500/90 rounded animate-ping"
                    ></div>
                    <Bot class="size-5 text-green-500 z-2" />

                    <div
                        class="ml-1 mt-1 absolute w-3 h-2.5 bg-accent rounded-xs z-1"
                    ></div>
                {:else}
                    <BotOff class="size-5 text-red-500" />
                {/if}
            </div>
        </Tooltip.Trigger>
        <Tooltip.Content align="start">
            <div class="flex flex-col gap-0.5">
                {#if isAssistantEnabled}
                    <p class="text-sm">Assistant is Active</p>
                {:else}
                    <p class="text-sm">Assistant is Disabled</p>
                    <p class="text-xs">No data processed, no suggestions</p>
                {/if}
            </div>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
