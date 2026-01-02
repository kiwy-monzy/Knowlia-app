<script lang="ts">
    import { Info } from "lucide-svelte";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";

    let { content }: { content: string } = $props();
</script>

<Tooltip.Provider>
    <Tooltip.Root>
        <Tooltip.Trigger>
            <Info class="w-4 h-4" />
        </Tooltip.Trigger>
        <Tooltip.Content>
            <p class="max-w-xs">
                {content}
            </p>
        </Tooltip.Content>
    </Tooltip.Root>
</Tooltip.Provider>
