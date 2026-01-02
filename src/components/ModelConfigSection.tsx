import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { globalConfig } from '@/lib/globalConfig';

interface ModelConfigSectionProps {
  type: "vision" | "chat";
  useSameModel: boolean;
  isValid: boolean;
  setValid: (valid: boolean) => void;
  enableBackgroundTasks: boolean;
  setEnableBackgroundTasks: (enabled: boolean) => void;
}

const ModelConfigSection: React.FC<ModelConfigSectionProps> = ({
  type,
  useSameModel,
  isValid,
  setValid,
  enableBackgroundTasks,
  setEnableBackgroundTasks,
}) => {
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
    ? "Configure the vision model for screenshot analysis"
    : "Configure the chat model for user intention analysis, suggestions, and chat";

  const [connectionError, setConnectionError] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>(
    type === "vision" ? globalConfig.vision_api_key : globalConfig.chat_api_key
  );
  const [baseUrl, setBaseUrl] = useState<string>(
    type === "vision" ? globalConfig.vision_base_url : globalConfig.chat_base_url
  );
  const [model, setModel] = useState<string>(
    type === "vision" ? globalConfig.vision_model : globalConfig.chat_model
  );

  // Sync with globalConfig when type changes or on mount
  useEffect(() => {
    const syncConfig = () => {
      const newApiKey = type === "vision" ? globalConfig.vision_api_key : globalConfig.chat_api_key;
      const newBaseUrl = type === "vision" ? globalConfig.vision_base_url : globalConfig.chat_base_url;
      const newModel = type === "vision" ? globalConfig.vision_model : globalConfig.chat_model;
      
      setApiKey(newApiKey);
      setBaseUrl(newBaseUrl);
      setModel(newModel);
    };
    
    syncConfig();
    
    // Listen for config changes
    let unlistenFn: (() => void) | null = null;
    const setupListener = async () => {
      const unlisten = await listen('set-config-value', () => {
        globalConfig.loadConfig().then(() => {
          syncConfig();
        });
      });
      unlistenFn = unlisten;
    };
    
    setupListener();
    
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [type]);

  const validateConnection = async (type: "vision" | "chat") => {
    if (!baseUrl) {
      setConnectionError("Please provide API URL");
      return;
    }

    setValid(false);
    setConnectionError("");
    const useVision = type === "vision";

    try {
      const valid = await invoke<boolean>("validate_connection", {
        useVision,
      });
      setValid(valid);
      setConnectionError("");
    } catch (error) {
      setValid(false);
      console.error(error);
      setConnectionError("No valid connection, check your API key and/or URL");
    }
  };

  const onConfigChange = async () => {
    setValid(false);
    setConnectionError("");
    // Use the enableBackgroundTasks parameter to avoid unused warning
    if (enableBackgroundTasks) {
      setEnableBackgroundTasks(false);
    }
    await invoke("set_config_value", {
      key: "enable_background_tasks",
      value: String(false),
    });
  };

  const globalconfigNamesMap = {
    base_url: type === "vision" ? "vision_base_url" : "chat_base_url",
    api_key: type === "vision" ? "vision_api_key" : "chat_api_key",
    model: type === "vision" ? "vision_model" : "chat_model",
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (type === "vision") {
      globalConfig.vision_api_key = value;
    } else {
      globalConfig.chat_api_key = value;
    }
    globalConfig.debounceSaveConfig(globalconfigNamesMap.api_key, value);
    onConfigChange();
  };

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    if (type === "vision") {
      globalConfig.vision_base_url = value;
    } else {
      globalConfig.chat_base_url = value;
    }
    globalConfig.debounceSaveConfig(globalconfigNamesMap.base_url, value);
    onConfigChange();
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    if (type === "vision") {
      globalConfig.vision_model = value;
    } else {
      globalConfig.chat_model = value;
    }
    globalConfig.debounceSaveConfig(globalconfigNamesMap.model, value);
    onConfigChange();
  };

  const handleProviderClick = (providerUrl: string) => {
    handleBaseUrlChange(providerUrl);
  };

  useEffect(() => {
    validateConnection(type);
  }, [type]);

  return (
    <div className="space-y-2 border rounded-lg p-4">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{typeTitle}</h3>
        <p className="text-sm text-muted-foreground">{typeDescription}</p>
      </div>

      {/* API Key */}
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor={`${type}-api-key`}>API Key</Label>
        <Input
          id={`${type}-api-key`}
          type="password"
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          className={`w-full ${connectionError ? "border-red-500" : ""}`}
        />
      </div>

      {/* Base URL */}
      <div className="grid w-full items-center gap-1.5">
        <div className="flex flex-row w-full gap-2">
          <Label htmlFor={`${type}-url`}>URL</Label>
          <div className="grid w-full items-center gap-1.5">
            {isValid ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <span>Valid Connection</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <span>{connectionError}</span>
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute left-3 top-1/2 z-10 h-7 -translate-y-1/2 px-3 text-xs"
            onClick={() => validateConnection(type)}
          >
            Test
          </Button>
          <Input
            id={`${type}-url`}
            type="text"
            placeholder="Enter base URL"
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            className={`pl-16 ${connectionError ? "border-red-500" : ""}`}
          />
        </div>
        <div className="flex flex-row gap-x-2 text-xs underline">
          {Object.entries(providers).map(([key, value]) => (
            <div key={key} className="grid w-full items-center gap-1">
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => handleProviderClick(value)}
              >
                {key}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="grid w-full items-center gap-1.5">
        <Label htmlFor={`${type}-model`}>Model</Label>
        <p className="text-sm text-muted-foreground">
          Enter the model name/identifier for the {type} model
        </p>
        <Input
          id={`${type}-model`}
          type="text"
          placeholder="Enter model name"
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default ModelConfigSection;
