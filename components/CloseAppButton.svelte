<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import AlertModal from "./AlertModal.svelte";
    import Button from "./ui/button/button.svelte";
    import X from "@lucide/svelte/icons/x";

    interface Props {
        open: boolean;
        onOpenChange: (open: boolean) => void;
    }

    let { open = $bindable(), onOpenChange }: Props = $props();

    async function handleConfirmClose() {
        try {
            await invoke("close_app");
        } catch (error) {
            console.error("Failed to close app:", error);
        }
    }
</script>

<div>
    <Button
        variant="destructive"
        onclick={() => (open = true)}
        class="absolute right-4 top-4 z-30"
    >
        <X class="w-4 h-4" />
        Close App
    </Button>
    <AlertModal
        {open}
        title="Close Application"
        description="Are you sure you want to close Loyca.ai?"
        buttonLabel="Close App"
        onConfirm={handleConfirmClose}
        {onOpenChange}
    />
</div>
