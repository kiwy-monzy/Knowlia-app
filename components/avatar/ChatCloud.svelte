<script lang="ts">
    import { slide } from "svelte/transition";
    import * as Alert from "$lib/components/ui/alert";
    import { Terminal, Wrench } from "lucide-svelte";
    import type { MessagePart } from "$lib/utils/messageParser";
    import MarkdownBlock from "./MarkdownBlock.svelte";
    import Thinking from "./Thinking.svelte";

    let {
        parts = [],
        error = "",
        visible = false,
        onContentChanged = () => {},
        currentTool = "",
        isProcessing = false,
        isThinking = false,
        chatSessionId = -1,
    } = $props<{
        parts: MessagePart[];
        error: string;
        isProcessing: boolean;
        visible: boolean;
        onContentChanged?: () => void;
        currentTool: string | null;
        isThinking: boolean;
        chatSessionId: number | null;
    }>();
</script>

<div
    class="chat-cloud absolute bg-background backdrop-blur-xl rounded-lg border p-4 overflow-y-auto w-[450px] max-h-[600px] z-10 right-0 text-sm text-foreground/90 leading-relaxed"
    class:visible
    style="top: 20px; right: 20px;"
    data-tauri-drag-region
>
    <!-- {#if chatSessionId && chatSessionId >= 0}
        <p
            class="sticky top-0 ml-auto w-max translate-x-4 -translate-y-4 text-sm text-foreground/50"
        >
            #{chatSessionId}
        </p>
    {/if} -->
    {#if error}
        <Alert.Root variant="destructive">
            <Terminal class="h-4 w-4" />
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
    {:else}
        {#each parts as part (part.type + part.content.length)}
            {#if part.type === "markdown"}
                <MarkdownBlock content={part.content} />
            {:else if part.type === "thinking"}
                <Thinking
                    content={part.content}
                    {isThinking}
                    onToggled={onContentChanged}
                />
            {/if}
        {/each}

        {#if currentTool}
            <div
                class="tool-indicator loading mt-2 flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-md"
            >
                <Wrench class="h-4 w-4 text-indigo-600" />
                <span class="text-sm text-indigo-700 font-medium"
                    >{currentTool}</span
                >
            </div>
        {/if}

        {#if isProcessing}
            <div class="loading"></div>
        {/if}
    {/if}

    {#if visible}
        <div
            class="transition-overlay"
            transition:slide={{ axis: "y", duration: 300 }}
        ></div>
    {/if}
</div>

<style>
    .chat-cloud {
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px);
        transition:
            opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
            visibility 0.3s;
    }

    .chat-cloud.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }

    /* Add scrollbar styles if you want them */
    .chat-cloud::-webkit-scrollbar {
        width: 6px;
    }
    .chat-cloud::-webkit-scrollbar-track {
        background: transparent;
    }
    .chat-cloud::-webkit-scrollbar-thumb {
        background: hsl(var(--muted-foreground) / 0.2);
        border-radius: 3px;
    }

    .transition-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: -1;
    }

    :global(.message-content) {
        max-width: 100%;
        overflow-wrap: break-word;
        word-wrap: break-word;
    }

    :global(.message-content h1),
    :global(.message-content h2),
    :global(.message-content h3) {
        margin: 0 0 12px 0;
        color: #1a202c;
        font-weight: 600;
        overflow-wrap: break-word;
        word-wrap: break-word;
    }

    :global(.message-content p),
    :global(.message-content div),
    :global(.message-content span) {
        overflow-wrap: break-word;
        word-wrap: break-word;
        max-width: 100%;
    }

    :global(.message-content code) {
        border-radius: 4px;
        word-break: break-word;
        overflow-wrap: break-word;
        max-width: 100%;
    }

    :global(.message-content pre) {
        overflow-x: auto;
        max-width: 100%;
        white-space: pre;
        background-color: #f6f8fa;
        padding: 8px;
        border-radius: 6px;
        margin: 8px 0;
    }

    :global(.message-content pre code) {
        white-space: pre;
        display: block;
        max-width: none;
    }

    :global(.message-content ul),
    :global(.message-content ol) {
        margin: 8px 0;
        padding-left: 20px;
        overflow-wrap: break-word;
        word-wrap: break-word;
    }

    :global(.message-content ul) {
        list-style-type: disc;
    }

    :global(.message-content ol) {
        list-style-type: decimal;
    }

    :global(.message-content li) {
        margin: 4px 0;
        overflow-wrap: break-word;
        word-wrap: break-word;
        max-width: 100%;
    }

    :global(.message-content ul li) {
        list-style-type: disc;
    }

    :global(.message-content ol li) {
        list-style-type: decimal;
    }

    :global(.message-content li p) {
        margin: 0;
        display: inline;
    }

    :global(.chat-cloud::-webkit-scrollbar) {
        width: 6px;
    }

    :global(.chat-cloud::-webkit-scrollbar-track) {
        background: transparent;
    }

    :global(.chat-cloud::-webkit-scrollbar-thumb) {
        background: rgba(99, 102, 241, 0.1);
        border-radius: 3px;
    }

    :global(.chat-cloud::-webkit-scrollbar-thumb:hover) {
        background: rgba(99, 102, 241, 0.3);
    }

    /* Scrollbar styles for code blocks */
    :global(.message-content pre::-webkit-scrollbar) {
        height: 6px;
    }

    :global(.message-content pre::-webkit-scrollbar-track) {
        background: transparent;
    }

    :global(.message-content pre::-webkit-scrollbar-thumb) {
        background: rgba(99, 102, 241, 0.1);
        border-radius: 3px;
    }

    :global(.message-content pre::-webkit-scrollbar-thumb:hover) {
        background: rgba(99, 102, 241, 0.3);
    }

    :global(.thinking-container) {
        margin-top: 12px;
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
        max-height: 20%;
        overflow-y: auto;
    }

    :global(.thinking-container details) {
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        background-color: #f7fafc;
    }

    :global(.thinking-container summary) {
        padding: 8px 12px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
        color: #2d3748;
    }

    :global(.thinking-content) {
        padding: 12px;
        border-top: 1px solid #e2e8f0;
        margin-top: 8px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        font-family: "SF Mono", Monaco, "Courier New", monospace;
        font-size: 0.85em;
        color: #1a202c;
        max-height: 200px;
        max-width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }

    :global(.thinking-container details[open]) {
        transition: all 0.2s ease-out;
    }

    .tool-indicator {
        animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .tool-indicator span {
        font-size: 0.875rem;
        line-height: 1.25rem;
    }

    .loading:after {
        overflow: hidden;
        display: inline-block;
        vertical-align: bottom;
        -webkit-animation: ellipsis steps(8, end) 900ms infinite;
        animation: ellipsis steps(8, end) 900ms infinite;
        content: "\2026";
        /* ascii code for the ellipsis character */
        width: 0px;
    }

    @keyframes ellipsis {
        to {
            width: 40px;
        }
    }

    @-webkit-keyframes ellipsis {
        to {
            width: 40px;
        }
    }
</style>
