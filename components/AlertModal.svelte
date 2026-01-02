<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import Button from "$lib/components/ui/button/button.svelte";
    import { TriangleAlert } from "lucide-svelte";

    interface Props {
        open: boolean;
        title: string;
        description: string;
        buttonLabel: string;
        onConfirm: () => void;
        onOpenChange: (open: boolean) => void;
    }

    let {
        open = $bindable(),
        title,
        description,
        buttonLabel,
        onConfirm,
        onOpenChange,
    }: Props = $props();

    function handleCancel() {
        onOpenChange(false);
    }
</script>

<Dialog.Root bind:open {onOpenChange}>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <div class="flex items-center gap-3">
                <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100"
                >
                    <TriangleAlert class="h-5 w-5 text-amber-600" />
                </div>
                <div>
                    <Dialog.Title>{title}</Dialog.Title>
                    <Dialog.Description class="mt-1">
                        {description}
                    </Dialog.Description>
                </div>
            </div>
        </Dialog.Header>
        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={handleCancel}>Cancel</Button>
            <Button variant="destructive" onclick={onConfirm}>
                {buttonLabel}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
