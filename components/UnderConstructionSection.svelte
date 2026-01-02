<script lang="ts">
    import { Construction } from "lucide-svelte";

    let { title, subtitle = "" }: { title: string; subtitle?: string } =
        $props();
</script>

<div class="max-w-6xl mx-auto space-y-8">
    <div>
        <div class="relative justify-start mb-2">
            <h2
                class="flex flex-row items-center text-3xl font-bold tracking-tight mb-2 gap-x-2"
            >
                {title}
                <Construction class="w-6 h-6 mr-2" />
            </h2>
            <p class="text-muted-foreground">{subtitle}</p>
            <p class="text-muted-foreground">Under construction</p>
        </div>
    </div>
</div>
