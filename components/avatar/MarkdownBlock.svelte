<script lang="ts">
    import { openUrl } from "@tauri-apps/plugin-opener";
    import { renderMarkdown } from "$lib/utils/messageParser";

    let { content = "" } = $props<{ content: string }>();
    let container: HTMLDivElement | undefined = $state();

    const handleLinks = () => {
        if (!container) return;
        const links = container.querySelectorAll("a[href]");
        links.forEach((link) => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const href = link.getAttribute("href");
                if (href) {
                    openUrl(href);
                }
            });
        });
    };

    $effect(() => {
        // When content changes, re-run link setup
        handleLinks();
    });
</script>

<div bind:this={container} class="markdown-content">
    {@html renderMarkdown(content)}
</div>
