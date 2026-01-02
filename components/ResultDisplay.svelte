<script lang="ts">
    import { type Screenshot, type UserIntentionHistory } from "$lib/types";
    import * as Card from "$lib/components/ui/card";
    import * as Alert from "$lib/components/ui/alert";
    import { Button } from "$lib/components/ui/button";
    import {
        Terminal,
        Brain,
        Target,
        Tag,
        Camera,
        FileText,
        Bot,
    } from "lucide-svelte";
    import { invoke } from "@tauri-apps/api/core";

    let { screenshot, userIntention, screenshotContext, ocr, error } = $props<{
        screenshot: Screenshot | null;
        userIntention: UserIntentionHistory | null;
        screenshotContext: string | null;
        ocr: string | null;
        error?: string;
    }>();

    let chosenArm: number | null = $state(null);
    let armError: string | null = $state(null);
    let armLoading = $state(false);

    async function getContextualBanditArm() {
        if (!userIntention?.id) return;

        armLoading = true;
        armError = null;
        chosenArm = null;

        try {
            const arm = await invoke<number>(
                "get_choosen_arm_from_user_intention_id",
                {
                    userIntentionId: userIntention.id,
                    fromTest: true,
                },
            );
            chosenArm = arm;
        } catch (err) {
            armError = err as string;
        } finally {
            armLoading = false;
        }
    }
</script>

<Card.Root class="min-h-[200px] max-h-[400px] w-full">
    <Card.Header>
        <Card.Title>Result</Card.Title>
        <Card.Description>
            {#if userIntention}
                <div class="flex items-center gap-2 font-semibold text-sm">
                    <Brain class="h-4 w-4" />
                    User Intention Results
                </div>
            {:else if screenshot}
                <div class="flex items-center gap-2 font-semibold text-sm">
                    <Camera class="h-4 w-4" />
                    Screenshot Analysis
                </div>
            {/if}
        </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4 overflow-auto">
        {#if error}
            <Alert.Root variant="destructive">
                <Terminal class="h-4 w-4" />
                <Alert.Title>Error</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
            </Alert.Root>
        {:else if screenshot}
            <div class="space-y-3">
                <div class="space-y-2">
                    <img
                        src={screenshot.screenshot_url}
                        alt="Screenshot preview"
                        class="max-h-64 w-full rounded-md border object-contain"
                    />

                    <div class="text-center text-sm text-muted-foreground">
                        <p>
                            {screenshot.title} ({screenshot.process_name})
                        </p>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center gap-2 font-semibold text-sm">
                        <FileText class="h-4 w-4" />
                        Description:
                    </div>
                    <div
                        class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                    >
                        {screenshot.llm_description}
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center gap-2 font-semibold text-sm">
                        <Tag class="h-4 w-4" />
                        Keywords:
                    </div>
                    <div
                        class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                    >
                        {screenshot.llm_keywords}
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center gap-2 font-semibold text-sm">
                        <Target class="h-4 w-4" />
                        Category:
                    </div>
                    <div
                        class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                    >
                        {screenshot.llm_category}
                    </div>
                </div>
            </div>
        {:else if ocr}
            <div class="space-y-2">
                <div class="flex items-center gap-2 font-semibold text-sm">
                    <Target class="h-4 w-4" />
                    OCR Result:
                </div>
                <div
                    class="text-sm text-muted-foreground p-3 bg-muted rounded-md break-keep whitespace-break-spaces"
                >
                    {ocr}
                </div>
            </div>
        {:else if screenshotContext}
            <div class="space-y-2">
                <div class="flex items-center gap-2 font-semibold text-sm">
                    <Target class="h-4 w-4" />
                    Context (for Suggestions):
                </div>
                <div
                    class="text-sm text-muted-foreground p-3 bg-muted rounded-md break-keep whitespace-break-spaces"
                >
                    {screenshotContext}
                </div>
            </div>
        {:else if userIntention}
            <div class="space-y-3">
                <div class="space-y-2">
                    <div class="flex items-center gap-2 font-semibold text-sm">
                        <Target class="h-4 w-4" />
                        Intention:
                    </div>
                    <div
                        class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                    >
                        {userIntention.llm_user_intention}
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="font-semibold text-sm">State:</div>
                    <div
                        class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                    >
                        {userIntention.llm_user_state}
                    </div>
                </div>

                {#if userIntention.llm_keywords}
                    <div class="space-y-2">
                        <div
                            class="flex items-center gap-2 font-semibold text-sm"
                        >
                            <Tag class="h-4 w-4" />
                            Keywords:
                        </div>
                        <div
                            class="text-sm text-muted-foreground p-3 bg-muted rounded-md"
                        >
                            {userIntention.llm_keywords}
                        </div>
                    </div>
                {/if}

                <div class="text-xs text-muted-foreground">
                    Analyzed at: {new Date(
                        userIntention.created_at,
                    ).toLocaleString()}
                </div>

                {#if userIntention.id}
                    <div class="pt-4 border-t">
                        <div class="space-y-3">
                            <Button.Root
                                variant="outline"
                                size="sm"
                                class="w-full"
                                onclick={getContextualBanditArm}
                                disabled={armLoading}
                            >
                                <Bot class="h-4 w-4 mr-2" />
                                {armLoading
                                    ? "Analyzing..."
                                    : "Get Contextual Bandit Decision"}
                            </Button.Root>

                            {#if chosenArm !== null}
                                <div class="space-y-2">
                                    <div
                                        class="flex items-center gap-2 font-semibold text-sm"
                                    >
                                        <Bot class="h-4 w-4" />
                                        Contextual Bandit Decision:
                                    </div>
                                    <div
                                        class="text-sm p-3 bg-muted rounded-md"
                                    >
                                        <span class="font-medium">
                                            Arm {chosenArm}: {chosenArm === 0
                                                ? "No Assist"
                                                : "Assist"}
                                        </span>
                                        <div
                                            class="text-xs text-muted-foreground mt-1"
                                        >
                                            The contextual bandit recommends {chosenArm ===
                                            0
                                                ? "not providing assistance"
                                                : "providing assistance"} based on
                                            current context.
                                        </div>
                                    </div>
                                </div>
                            {/if}

                            {#if armError}
                                <Alert.Root variant="destructive">
                                    <Terminal class="h-4 w-4" />
                                    <Alert.Title
                                        >Contextual Bandit Error</Alert.Title
                                    >
                                    <Alert.Description
                                        >{armError}</Alert.Description
                                    >
                                </Alert.Root>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </Card.Content>
</Card.Root>
