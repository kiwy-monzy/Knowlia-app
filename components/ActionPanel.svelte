<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";

    import {
        AppWindow,
        Brain,
        Camera,
        LoaderCircleIcon,
        TextSelect,
    } from "lucide-svelte";
    import ResultDisplay from "./ResultDisplay.svelte";
    import type { Screenshot, UserIntentionHistory } from "$lib/types";
    import {
        analyzeUserIntention,
        takeScreenshot,
        getScreenshotsContext,
        getScreenshotOCR,
    } from "$lib/utils/commands";

    let { error = $bindable() } = $props<{
        error?: string;
    }>();

    let currentAction = $state<
        "screenshot" | "analyze" | "screenshot_context" | "ocr"
    >("screenshot");
    let screenshot = $state<Screenshot | null>(null);
    let userIntention = $state<UserIntentionHistory | null>(null);
    let isAnalyzing = $state(false);
    let screenshotContext = $state<string>("");
    let ocr = $state<string | null>(null);

    async function handleAnalyzeUserIntention() {
        isAnalyzing = true;
        screenshotContext = "";
        screenshot = null;
        userIntention = null;
        ocr = null;
        error = "";

        try {
            const result = await analyzeUserIntention(15);
            userIntention = result;
        } catch (err) {
            console.error("Failed to analyze user intention:", err);
            error = err instanceof Error ? err.message : String(err);
        } finally {
            isAnalyzing = false;
        }
    }

    async function handleTakeScreenshot(mode: "window" | "fullscreen") {
        isAnalyzing = true;
        screenshotContext = "";
        screenshot = null;
        userIntention = null;
        ocr = null;
        error = "";
        const resp = await takeScreenshot(mode);
        screenshot = resp.screenshot;
        error = resp.error;
        isAnalyzing = false;
    }

    async function handleGetScreenshotContext() {
        isAnalyzing = true;
        screenshotContext = "";
        screenshot = null;
        userIntention = null;
        ocr = null;
        error = "";
        const resp = await getScreenshotsContext();
        if (!resp) {
            error = "No screenshot context available";
        } else {
            screenshotContext = resp;
        }
        isAnalyzing = false;
    }

    async function handleGetScreenshotOCR() {
        isAnalyzing = true;
        screenshotContext = "";
        screenshot = null;
        userIntention = null;
        ocr = null;
        error = "";
        const resp = await getScreenshotOCR();
        if (!resp) {
            error = "No OCR available";
        } else {
            ocr = resp;
        }
        isAnalyzing = false;
    }
</script>

<Card.Root>
    <Card.Header>
        <Card.Title>Actions</Card.Title>
        <Card.Description>
            {#if isAnalyzing}
                <div
                    class="flex items-center text-sm text-muted-foreground pt-2"
                >
                    <LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
                    Processing {currentAction}...
                </div>
            {:else}
                Choose an action to perform
            {/if}
        </Card.Description>
    </Card.Header>
    <Card.Content class="flex items-center  flex-col space-y-4">
        <div class="grid grid-cols-2 gap-2">
            <Button
                variant="outline"
                class="w-full"
                disabled={isAnalyzing}
                onclick={() => {
                    handleTakeScreenshot("window");
                    currentAction = "screenshot";
                }}
            >
                <Camera class="h-4 w-4" />
                Get Active Window
            </Button>
            <Button
                variant="outline"
                class="w-full"
                disabled={isAnalyzing}
                onclick={() => {
                    handleAnalyzeUserIntention();
                    currentAction = "analyze";
                }}
            >
                <Brain class="h-4 w-4" />
                Analyze User Intention
            </Button>
            <Button
                variant="outline"
                class="w-full"
                disabled={isAnalyzing}
                onclick={() => {
                    handleGetScreenshotOCR();
                    currentAction = "ocr";
                }}
            >
                <TextSelect class="h-4 w-4" />
                Active Window OCR
            </Button>
            <Button
                variant="outline"
                class="w-full"
                disabled={isAnalyzing}
                onclick={() => {
                    handleGetScreenshotContext();
                    currentAction = "screenshot_context";
                }}
            >
                <AppWindow class="h-4 w-4" />
                Get Screenshots Context
            </Button>
        </div>

        <ResultDisplay
            {screenshot}
            {ocr}
            {userIntention}
            {screenshotContext}
            {error}
        />
    </Card.Content>
</Card.Root>
