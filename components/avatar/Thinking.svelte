<script lang="ts">
    import * as Accordion from "$lib/components/ui/accordion";
    import { Lightbulb } from "lucide-svelte";
    import MarkdownBlock from "./MarkdownBlock.svelte";
    import { tick } from "svelte";

    let {
        content = "",
        isThinking = false,
        onToggled = () => {},
    } = $props<{
        content: string;
        isThinking: boolean;
        onToggled: () => void;
    }>();

    let isUserScrolling = $state(false);
    let isOpenByUser = $state(false);

    let contentContainer: HTMLDivElement;
    let scrollTimeout: ReturnType<typeof setTimeout>;

    let accordionValue = $derived(
        isThinking || isOpenByUser ? "item-1" : undefined,
    );

    $effect(() => {
        const _dependency = content;

        if (contentContainer && isThinking && !isUserScrolling) {
            // Use tick() to wait for the DOM to update before scrolling.
            tick().then(() => {
                contentContainer.scrollTop = contentContainer.scrollHeight;
            });
        }
    });

    const handleScroll = () => {
        if (!contentContainer) return;
        isUserScrolling = true;
        clearTimeout(scrollTimeout);

        const isAtBottom =
            contentContainer.scrollTop + contentContainer.clientHeight >=
            contentContainer.scrollHeight - 10;

        if (isAtBottom) {
            isUserScrolling = false;
        } else {
            scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
            }, 2000);
        }
    };
</script>

<div
    class="my-4 border border-gray-300 rounded-lg px-2"
    class:thinking={isThinking}
>
    <Accordion.Root class="w-full" type="single" value={accordionValue}>
        <Accordion.Item value="item-1" class="p-0">
            <Accordion.Trigger
                class="text-sm font-medium"
                onclick={() => {
                    if (!isThinking) {
                        isOpenByUser = !isOpenByUser;
                        setTimeout(() => {
                            onToggled();
                        }, 200);
                    }
                }}
                disabled={isThinking}
            >
                <div class="flex items-center">
                    <Lightbulb />
                    {#if isThinking}
                        <span class="thinking-indicator"> Thinking... </span>
                    {:else}
                        Thinking
                    {/if}
                </div>
            </Accordion.Trigger>
            <Accordion.Content>
                <div
                    class="thinking-content text-xs"
                    bind:this={contentContainer}
                    onscroll={handleScroll}
                >
                    <MarkdownBlock {content} />
                </div>
            </Accordion.Content>
        </Accordion.Item>
    </Accordion.Root>
</div>

<style>
    .thinking-indicator {
        display: inline-flex;
        align-items: center;
    }

    .thinking :global([data-state="open"]),
    .thinking :global([data-state="closed"]) {
        animation: none !important;
        transition: none !important;
    }

    .thinking-content {
        max-height: 300px;
        overflow-y: auto;
        scroll-behavior: auto;
    }
</style>
