import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Card } from './SimpleCard';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { TriangleAlert } from 'lucide-react';
import { SimpleTabs } from './SimpleTabs';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import SimpleTooltip from './SimpleTooltip';
import ModelConfigSection from './ModelConfigSection';
import AsMcpServer from './AsMcpServer';
import { globalConfig } from '@/lib/globalConfig';

interface EmbeddingServiceInfo {
  model_id: string;
  revision: string;
  is_ready: boolean;
  device: string;
}

interface OcrServiceInfo {
  is_ready: boolean;
  models_loaded: boolean;
}


const ConfigForm: React.FC = () => {
  const [featureExtractorProgress, setFeatureExtractorProgress] = useState(0);
  const [featureExtractorInfo, setFeatureExtractorInfo] = useState<EmbeddingServiceInfo>({
    model_id: "Unknown",
    revision: "Unknown",
    is_ready: false,
    device: "CPU",
  });
  const [ocrInfo, setOcrInfo] = useState<OcrServiceInfo>({
    is_ready: false,
    models_loaded: false,
  });

  // Connection validation state
  const [isVisionValid, setIsVisionValid] = useState(false);
  const [isChatValid, setIsChatValid] = useState(false);

  // Local state for UI updates
  const [useSameModel, setUseSameModel] = useState(globalConfig.use_same_model);
  const [enableBackgroundTasks, setEnableBackgroundTasks] = useState(globalConfig.enable_background_tasks);
  const [screenshotDelay, setScreenshotDelay] = useState(globalConfig.screenshot_delay);
  const [userIntentionDelay, setUserIntentionDelay] = useState(globalConfig.user_intention_delay);

  const canUseAssistant = useSameModel 
    ? isVisionValid 
    : isVisionValid && isChatValid;

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      await globalConfig.loadConfig();
      setUseSameModel(globalConfig.use_same_model);
      setEnableBackgroundTasks(globalConfig.enable_background_tasks);
      setScreenshotDelay(globalConfig.screenshot_delay);
      setUserIntentionDelay(globalConfig.user_intention_delay);
    };
    loadConfig();
  }, []);

  // Listen for config changes
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    
    const setupConfigListener = async () => {
      const unlisten = await listen('set-config-value', () => {
        // Reload config when it changes
        globalConfig.loadConfig().then(() => {
          setUseSameModel(globalConfig.use_same_model);
          setEnableBackgroundTasks(globalConfig.enable_background_tasks);
          setScreenshotDelay(globalConfig.screenshot_delay);
          setUserIntentionDelay(globalConfig.user_intention_delay);
        });
      });
      unlistenFn = unlisten;
    };
    
    setupConfigListener();
    
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        await invoke("init_embedding_service");

        // Listen for embedding status updates
        const unlistenEmbeddingStatus = await listen<number>(
          "embedding-status",
          (event) => {
            const progress = event.payload;
            setFeatureExtractorProgress(progress);
            if (progress === 100) {
              invoke<EmbeddingServiceInfo>("embedding_service_info").then(
                (info) => {
                  setFeatureExtractorInfo(info);
                }
              );
            }
          }
        );

        const info = await invoke<EmbeddingServiceInfo>("embedding_service_info");
        setFeatureExtractorInfo(info);

        await invoke("init_ocr_service");
        const ocrServiceInfo = await invoke<OcrServiceInfo>("ocr_service_info");
        setOcrInfo(ocrServiceInfo);

        return () => {
          unlistenEmbeddingStatus();
        };
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card.Root>
          <Card.Content className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <div className="flex items-center space-x-2">
                <Switch
                  id="use-same-model"
                  checked={useSameModel}
                  onCheckedChange={(checked) => {
                    setUseSameModel(checked);
                    globalConfig.debounceSaveConfig("use_same_model", String(checked));
                  }}
                />
                <Label htmlFor="use-same-model">
                  Use the same model for everything
                </Label>
                <SimpleTooltip
                  content="Knoly.ai requires a vision model for screenshot analysis and any other LLM for text analysis."
                />
              </div>
            </div>
            {useSameModel ? (
              // Single Model Configuration
              <div className="grid w-full items-center gap-1.5">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <TriangleAlert className="size-4" />
                  The model will be used for both vision and chat tasks
                </p>
                <ModelConfigSection
                  type="vision"
                  useSameModel={useSameModel}
                  isValid={isVisionValid}
                  setValid={setIsVisionValid}
                  enableBackgroundTasks={enableBackgroundTasks}
                  setEnableBackgroundTasks={(enabled) => {
                    setEnableBackgroundTasks(enabled);
                    globalConfig.debounceSaveConfig("enable_background_tasks", String(enabled));
                  }}
                />
              </div>
            ) : (
              <SimpleTabs defaultValue="vision">
                <SimpleTabs.List>
                  <SimpleTabs.Trigger value="vision">Vision Model</SimpleTabs.Trigger>
                  <SimpleTabs.Trigger value="chat">Chat Model</SimpleTabs.Trigger>
                </SimpleTabs.List>
                <SimpleTabs.TabsContent value="vision">
                  <ModelConfigSection
                    type="vision"
                    useSameModel={useSameModel}
                    isValid={isVisionValid}
                    setValid={setIsVisionValid}
                    enableBackgroundTasks={enableBackgroundTasks}
                    setEnableBackgroundTasks={(enabled) => {
                      setEnableBackgroundTasks(enabled);
                      globalConfig.debounceSaveConfig("enable_background_tasks", String(enabled));
                    }}
                  />
                </SimpleTabs.TabsContent>
                <SimpleTabs.TabsContent value="chat">
                  <ModelConfigSection
                    type="chat"
                    useSameModel={useSameModel}
                    isValid={isChatValid}
                    setValid={setIsChatValid}
                    enableBackgroundTasks={enableBackgroundTasks}
                    setEnableBackgroundTasks={(enabled) => {
                      setEnableBackgroundTasks(enabled);
                      globalConfig.debounceSaveConfig("enable_background_tasks", String(enabled));
                    }}
                  />
                </SimpleTabs.TabsContent>
              </SimpleTabs>
            )}
          </Card.Content>
        </Card.Root>

        <Card.Root className={`pt-0 lg:pt-4 ${canUseAssistant ? "" : "border-amber-500"}`}>
          <div className="w-full flex flex-col items-center justify-between p-4 bg-white gap-y-4">
            <div className="w-full flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-medium">Enable Assistant</h4>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      enableBackgroundTasks
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                </div>
                <span className="flex items-center gap-x-1 text-sm text-muted-foreground">
                  {!canUseAssistant ? (
                    <>
                      <TriangleAlert className="size-5 text-amber-600" />
                      Please validate API connection first to enable assistant.
                    </>
                  ) : (
                    "Automatically capture active window and user intention, and provide suggestions."
                  )}
                </span>
              </div>
              <Switch
                id="background-tasks"
                checked={enableBackgroundTasks}
                disabled={!canUseAssistant}
                onCheckedChange={(checked) => {
                  setEnableBackgroundTasks(checked);
                  globalConfig.debounceSaveConfig("enable_background_tasks", String(checked));
                }}
              />
            </div>
            <div className="w-full flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
              <div className="space-y-0.5">
                <h4 className="text-sm font-medium">Screenshot Capture Delay</h4>
                <p className="text-sm text-muted-foreground">
                  Delay to capture active window
                </p>
              </div>
              <div className="flex flex-col w-20 items-center">
                <Slider
                  value={[screenshotDelay]}
                  onValueChange={(value) => {
                    setScreenshotDelay(value[0]);
                    globalConfig.debounceSaveConfig("screenshot_delay", String(value[0]));
                  }}
                  min={10}
                  max={20}
                  step={1}
                />
                {screenshotDelay} sec
              </div>
            </div>
            <div className="w-full flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
              <div className="space-y-0.5">
                <h4 className="text-sm font-medium">User intention delay</h4>
                <p className="text-sm text-muted-foreground">
                  Delay to process user intention
                </p>
              </div>
              <div className="flex flex-col w-20 items-center">
                <Slider
                  value={[userIntentionDelay]}
                  onValueChange={(value) => {
                    setUserIntentionDelay(value[0]);
                    globalConfig.debounceSaveConfig("user_intention_delay", String(value[0]));
                  }}
                  min={5}
                  max={30}
                  step={1}
                />
                {userIntentionDelay} min
              </div>
            </div>
            <AsMcpServer
              assistantEnabled={enableBackgroundTasks}
            />
          </div>
        </Card.Root>
      </div>
      <div className="w-full lg:w-2/3 lg:mx-auto">
        <Card.Root>
          <Card.Content>
            <div className="flex flex-col gap-y-2">
              <div className="space-y-2">
                <Label className="text-xl">AI Services Status</Label>
                {/* Feature Extractor Status */}
                <div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Feature Extractor
                      <SimpleTooltip
                        content="Used for semantic search and to use text embeddings as features in the Contextual Bandit"
                      />
                    </span>

                    {featureExtractorInfo.is_ready ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-600">Ready</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-yellow-600">Loading...</span>
                      </div>
                    )}
                  </div>
                  {featureExtractorInfo.is_ready ? (
                    <span className="text-xs text-muted-foreground">
                      {featureExtractorInfo?.model_id || "Unknown"}
                    </span>
                  ) : (
                    <div className="mt-2">
                      <Progress
                        value={featureExtractorProgress}
                        className="w-full h-2"
                      />
                    </div>
                  )}
                </div>
                {/* OCR Status */}
                <div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      OCR
                      <SimpleTooltip content="Used as a tool for OCR" />
                    </span>
                    {ocrInfo.is_ready ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-600">Ready</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-yellow-600">Loading...</span>
                      </div>
                    )}
                  </div>
                  {ocrInfo.is_ready && (
                    <a
                      href="https://github.com/robertknight/ocrs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground"
                    >
                      {"https://github.com/robertknight/ocrs"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </>
  );
};

export default ConfigForm;
