<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { invoke } from "@tauri-apps/api/core";
    import { globalConfig } from "$lib/stores/globalConfig.svelte";
    import { onMount } from "svelte";

    interface Props {
        type: "vision" | "chat";
        useSameModel: boolean;
        isValid: boolean;
        enableBackgroundTasks: boolean;
    }

    let {
        type,
        useSameModel,
        isValid = $bindable(),
        enableBackgroundTasks = $bindable(),
    }: Props = $props();

    const providers = {
        OpenRouter: "https://openrouter.ai/api",
        "LM-Studio": "http://127.0.0.1:1234",
        Ollama: "http://127.0.0.1:11434",
        Custom: "",
    };

    const typeTitle = useSameModel
        ? "Model"
        : type === "vision"
          ? "Vision Model"
          : "Chat Model";
    const typeDescription = useSameModel
        ? "Configure the model for screenshot, user intention analysis, chat, and suggestions"
        : type === "vision"
          ? "Configure the vision model for screenshot  analysis"
          : "Configure the chat model for user intention analysis, suggestions, and chat";

    let connectionError: string | null = $state("");

    let apiKey = $derived(
        type === "vision"
            ? globalConfig.vision_api_key
            : globalConfig.chat_api_key,
    );
    let baseUrl = $derived(
        type === "vision"
            ? globalConfig.vision_base_url
            : globalConfig.chat_base_url,
    );
    let model = $derived(
        type === "vision" ? globalConfig.vision_model : globalConfig.chat_model,
    );

    let globalconfigNamesMap = $derived({
        base_url: type === "vision" ? "vision_base_url" : "chat_base_url",
        api_key: type === "vision" ? "vision_api_key" : "chat_api_key",
        model: type === "vision" ? "vision_model" : "chat_model",
    });

    async function validateConnection(type: "vision" | "chat") {
        if (!baseUrl) {
            connectionError = "Please provide API URL";
            return;
        }

        isValid = false;
        connectionError = "";
        const useVision = type === "vision";

        try {
            isValid = await invoke<boolean>("validate_connection", {
                useVision,
            });
            connectionError = "";
        } catch (error) {
            isValid = false;
            console.error(error);
            connectionError =
                "No valid connection, check your API key and/or URL";
        }
    }

    async function onConfigChange() {
        isValid = false;
        connectionError = "";
        enableBackgroundTasks = false;
        await invoke("set_config_value", {
            key: "enable_background_tasks",
            value: String(false),
        });
    }

    onMount(() => {
        validateConnection(type);
    });
</script>

<div class="space-y-2 border rounded-lg p-4">
    <div class="space-y-1">
        <h3 class="text-lg font-medium">{typeTitle}</h3>
        <p class="text-sm text-muted-foreground">{typeDescription}</p>
    </div>

    <!-- API Key -->
    <div class="grid w-full items-center gap-1.5">
        <Label for="{type}-api-key">API Key</Label>
        <Input
            id="{type}-api-key"
            type="password"
            placeholder="Enter your API key"
            value={apiKey}
            oninput={(e) => {
                if (type === "vision") {
                    globalConfig.vision_api_key = e.currentTarget.value;
                } else {
                    globalConfig.chat_api_key = e.currentTarget.value;
                }
                globalConfig.debounceSaveConfig(
                    globalconfigNamesMap.api_key,
                    e.currentTarget.value,
                );
                onConfigChange();
            }}
            class={`w-full ${connectionError ? "border-red-500" : ""}`}
        />
    </div>

    <!-- Base URL -->
    <div class="grid w-full items-center gap-1.5">
        <div class="flex flex-row w-full gap-2">
            <Label for="{type}-url">URL</Label>
            <div class="grid w-full items-center gap-1.5">
                {#if isValid}
                    <div class="flex items-center gap-2 text-sm text-green-600">
                        <span>Valid Connection</span>
                    </div>
                {:else}
                    <div class="flex items-center gap-2 text-sm text-red-600">
                        <span>{connectionError}</span>
                    </div>
                {/if}
            </div>
        </div>
        <div class="relative">
            <Button
                variant="outline"
                size="sm"
                class="absolute left-3 top-1/2 z-10 h-7 -translate-y-1/2 px-3 text-xs"
                onclick={() => validateConnection(type)}
            >
                Test
            </Button>
            <Input
                id="{type}-url"
                type="text"
                placeholder="Enter base URL"
                value={baseUrl}
                oninput={(e) => {
                    if (type === "vision") {
                        globalConfig.vision_base_url = e.currentTarget.value;
                    } else {
                        globalConfig.chat_base_url = e.currentTarget.value;
                    }
                    globalConfig.debounceSaveConfig(
                        globalconfigNamesMap.base_url,
                        e.currentTarget.value,
                    );
                    onConfigChange();
                }}
                class={`pl-16 ${connectionError ? "border-red-500" : ""}`}
            />
        </div>
        <div class="flex flex-row gap-x-2 text-xs underline">
            {#each Object.entries(providers) as [key, value]}
                <div class="grid w-full items-center gap-1">
                    <button
                        type="button"
                        class="cursor-pointer"
                        onclick={() => {
                            if (type === "vision") {
                                globalConfig.vision_base_url = value;
                            } else {
                                globalConfig.chat_base_url = value;
                            }
                            globalConfig.debounceSaveConfig(
                                globalconfigNamesMap.base_url,
                                value,
                            );
                            onConfigChange();
                        }}
                    >
                        {key}
                    </button>
                </div>
            {/each}
        </div>
    </div>

    <!-- Model -->
    <div class="grid w-full items-center gap-1.5">
        <Label for="{type}-model">Model</Label>
        <p class="text-sm text-muted-foreground">
            Enter the model name/identifier for the {type} model
        </p>
        <Input
            id="{type}-model"
            type="text"
            placeholder="Enter model name"
            value={model}
            oninput={(e) => {
                if (type === "vision") {
                    globalConfig.vision_model = e.currentTarget.value;
                } else {
                    globalConfig.chat_model = e.currentTarget.value;
                }
                globalConfig.debounceSaveConfig(
                    globalconfigNamesMap.model,
                    e.currentTarget.value,
                );
                onConfigChange();
            }}
            class="w-full"
        />
    </div>
</div>
