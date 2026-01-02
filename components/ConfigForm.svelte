<script lang="ts">
    import { Label } from "$lib/components/ui/label";
    import * as Card from "$lib/components/ui/card";
    import { Slider } from "$lib/components/ui/slider";
    import { Switch } from "$lib/components/ui/switch";
    import { Progress } from "$lib/components/ui/progress";
    import { globalConfig } from "$lib/stores/globalConfig.svelte";
    import { onMount } from "svelte";
    import { listen } from "@tauri-apps/api/event";
    import type { EmbeddingServiceInfo, OcrServiceInfo } from "$lib/types";
    import { invoke } from "@tauri-apps/api/core";
    import { TriangleAlert } from "lucide-svelte";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import ModelConfigSection from "./ModelConfigSection.svelte";
    import AsMcpServer from "./AsMcpServer.svelte";
    import InfoTooltip from "./InfoTooltip.svelte";

    let featureExtractorProgress = $state(0);
    let featureExtractorInfo = $state<EmbeddingServiceInfo>({
        model_id: "Unknown",
        revision: "Unknown",
        is_ready: false,
        device: "CPU",
    });
    let ocrInfo = $state<OcrServiceInfo>({
        is_ready: false,
        models_loaded: false,
    });

    // Connection validation state
    let isVisionValid = $state(false);
    let isChatValid = $state(false);
    let canUseAssistant = $derived(
        globalConfig.use_same_model
            ? isVisionValid
            : isVisionValid && isChatValid,
    );

    onMount(async () => {
        invoke("init_embedding_service");

        // Listen for embedding status updates
        const unlistenEmbeddingStatus = await listen(
            "embedding-status",
            (event: { payload: number }) => {
                const progress = event.payload;
                featureExtractorProgress = progress;
                if (progress === 100) {
                    invoke<EmbeddingServiceInfo>("embedding_service_info").then(
                        (info) => {
                            featureExtractorInfo = info;
                        },
                    );
                }
            },
        );

        invoke<EmbeddingServiceInfo>("embedding_service_info").then((info) => {
            featureExtractorInfo = info;
        });

        invoke("init_ocr_service").then(() => {
            invoke<OcrServiceInfo>("ocr_service_info").then((info) => {
                ocrInfo = info;
            });
        });
    });
</script>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card.Root>
        <Card.Content class="space-y-4">
            <div class="grid w-full items-center gap-1.5">
                <div class="flex items-center space-x-2">
                    <Switch
                        id="use-same-model"
                        bind:checked={globalConfig.use_same_model}
                        onCheckedChange={(checked) =>
                            globalConfig.debounceSaveConfig(
                                "use_same_model",
                                String(checked),
                            )}
                    />
                    <Label for="use-same-model"
                        >Use the same model for everything</Label
                    >
                    <InfoTooltip
                        content="Loyca.ai requires a vision model for screenshot analysis and any other LLM for text analysis."
                    />
                </div>
            </div>
            {#if globalConfig.use_same_model}
                <!-- Single Model Configuration -->
                <div class="grid w-full items-center gap-1.5">
                    <p
                        class="text-sm text-muted-foreground flex items-center gap-2"
                    >
                        <TriangleAlert class="size-4" />
                        The model will be used for both vision and chat tasks
                    </p>
                    <ModelConfigSection
                        type="vision"
                        useSameModel={globalConfig.use_same_model}
                        bind:isValid={isVisionValid}
                        bind:enableBackgroundTasks={
                            globalConfig.enable_background_tasks
                        }
                    />
                </div>
            {:else}
                <Tabs.Root value="vision">
                    <Tabs.List>
                        <Tabs.Trigger value="vision">Vision Model</Tabs.Trigger>
                        <Tabs.Trigger value="chat">Chat Model</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="vision">
                        <ModelConfigSection
                            type="vision"
                            useSameModel={globalConfig.use_same_model}
                            bind:isValid={isVisionValid}
                            bind:enableBackgroundTasks={
                                globalConfig.enable_background_tasks
                            }
                        />
                    </Tabs.Content>
                    <Tabs.Content value="chat">
                        <ModelConfigSection
                            type="chat"
                            useSameModel={globalConfig.use_same_model}
                            bind:isValid={isChatValid}
                            bind:enableBackgroundTasks={
                                globalConfig.enable_background_tasks
                            }
                        /></Tabs.Content
                    >
                </Tabs.Root>
            {/if}
        </Card.Content>
    </Card.Root>

    <Card.Root
        class={`pt-0 lg:pt-4 ${canUseAssistant ? "" : "border-amber-500"}`}
    >
        <div
            class="w-full flex flex-col items-center justify-between p-4 bg-white gap-y-4"
        >
            <div class="w-full flex flex-row items-center justify-between">
                <div class="space-y-1">
                    <div class="flex items-center gap-3">
                        <h4 class="text-lg font-medium">Enable Assistant</h4>
                        <div
                            class={`w-2 h-2 rounded-full ${
                                globalConfig.enable_background_tasks
                                    ? "bg-green-500"
                                    : "bg-red-500"
                            }`}
                        ></div>
                    </div>
                    <span
                        class="flex items-center gap-x-1 text-sm text-muted-foreground"
                    >
                        {#if !canUseAssistant}
                            <TriangleAlert class="size-5 text-amber-600" />
                            Please validate API connection first to enable assistant.
                        {:else}
                            Automatically capture active window and user
                            intention, and provide suggestions.
                        {/if}
                    </span>
                </div>
                <Switch
                    id="background-tasks"
                    bind:checked={globalConfig.enable_background_tasks}
                    disabled={!canUseAssistant}
                    onCheckedChange={(checked) =>
                        globalConfig.debounceSaveConfig(
                            "enable_background_tasks",
                            String(checked),
                        )}
                />
            </div>
            <div
                class="w-full flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
            >
                <div class="space-y-0.5">
                    <h4 class="text-sm font-medium">
                        Screenshot Capture Delay
                    </h4>
                    <p class="text-sm text-muted-foreground">
                        Delay to capture active window
                    </p>
                </div>
                <div class="flex flex-col w-20 items-center">
                    <Slider
                        type="single"
                        bind:value={globalConfig.screenshot_delay}
                        min={10}
                        max={20}
                        step={1}
                        onValueChange={(value) =>
                            globalConfig.debounceSaveConfig(
                                "screenshot_delay",
                                String(value),
                            )}
                    />
                    {globalConfig.screenshot_delay} sec
                </div>
            </div>
            <div
                class="w-full flex items-center justify-between px-4 py-2 rounded-lg border bg-white"
            >
                <div class="space-y-0.5">
                    <h4 class="text-sm font-medium">User intention delay</h4>
                    <p class="text-sm text-muted-foreground">
                        Delay to process user intention
                    </p>
                </div>
                <div class="flex flex-col w-20 items-center">
                    <Slider
                        type="single"
                        bind:value={globalConfig.user_intention_delay}
                        min={5}
                        max={30}
                        step={1}
                        onValueChange={(value) =>
                            globalConfig.debounceSaveConfig(
                                "user_intention_delay",
                                String(value),
                            )}
                    />
                    {globalConfig.user_intention_delay} min
                </div>
            </div>
            <AsMcpServer
                assistantEnabled={globalConfig.enable_background_tasks}
            />
        </div>
    </Card.Root>
</div>
<div class="w-full lg:w-2/3 lg:mx-auto">
    <Card.Root>
        <Card.Content>
            <div class="flex flex-col gap-y-2">
                <div class="space-y-2">
                    <Label class="text-xl">AI Services Status</Label>
                    <!-- Feature Extractor Status -->
                    <div>
                        <div class="flex justify-between items-center">
                            <span
                                class="flex items-center gap-2 text-sm font-medium"
                                >Feature Extractor
                                <InfoTooltip
                                    content="Used for semantic search and to use text embeddings as features in the Contextual Bandit"
                                />
                            </span>

                            {#if featureExtractorInfo.is_ready}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="h-2 w-2 bg-green-500 rounded-full"
                                    ></div>
                                    <span class="text-sm text-green-600"
                                        >Ready</span
                                    >
                                </div>
                            {:else}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"
                                    ></div>
                                    <span class="text-sm text-yellow-600"
                                        >Loading...</span
                                    >
                                </div>
                            {/if}
                        </div>
                        {#if featureExtractorInfo.is_ready}
                            <span class="text-xs text-muted-foreground">
                                {featureExtractorInfo?.model_id || "Unknown"}
                            </span>
                        {:else}
                            <div class="mt-2">
                                <Progress
                                    value={featureExtractorProgress}
                                    class="w-full h-2"
                                />
                            </div>
                        {/if}
                    </div>
                    <!-- OCR Status -->
                    <div>
                        <div class="flex justify-between items-center">
                            <span
                                class="flex items-center gap-2 text-sm font-medium"
                            >
                                OCR
                                <InfoTooltip
                                    content="Used as a tool for OCR"
                                /></span
                            >
                            {#if ocrInfo.is_ready}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="h-2 w-2 bg-green-500 rounded-full"
                                    ></div>
                                    <span class="text-sm text-green-600"
                                        >Ready</span
                                    >
                                </div>
                            {:else}
                                <div class="flex items-center gap-2">
                                    <div
                                        class="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"
                                    ></div>
                                    <span class="text-sm text-yellow-600"
                                        >Loading...</span
                                    >
                                </div>
                            {/if}
                        </div>
                        {#if ocrInfo.is_ready}
                            <a
                                href="https://github.com/robertknight/ocrs"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-xs text-muted-foreground"
                            >
                                {"https://github.com/robertknight/ocrs"}
                            </a>
                        {/if}
                    </div>
                </div>
            </div></Card.Content
        >
    </Card.Root>
</div>
