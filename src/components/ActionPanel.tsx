import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AppWindow,
  Brain,
  Camera,
  Loader2,
  TextSelect,
} from 'lucide-react';
import ResultDisplay from './ResultDisplay';
import { MeshGradient } from "@paper-design/shaders-react";
import {
  analyzeUserIntention,
  takeScreenshot,
  getScreenshotsContext,
  getScreenshotOCR,
} from '@/utils/commands';

interface Screenshot {
  id: string;
  data: string;
  timestamp: number;
  type: string;
  screenshot_url?: string;
  title?: string;
  process_name?: string;
  llm_description?: string;
  llm_keywords?: string;
  llm_category?: string;
}

interface UserIntentionHistory {
  id?: string;
  llm_user_intention: string;
  llm_user_state: string;
  llm_keywords?: string;
  created_at: number | string;
}

interface ActionPanelProps {
  error?: string;
  onErrorChange?: (error: string) => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ error, onErrorChange }) => {
  const [currentAction, setCurrentAction] = useState<
    'screenshot' | 'analyze' | 'screenshot_context' | 'ocr'
  >('screenshot');
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [userIntention, setUserIntention] = useState<UserIntentionHistory | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [screenshotContext, setScreenshotContext] = useState<string>('');
  const [ocr, setOcr] = useState<string | null>(null);

  const handleAnalyzeUserIntention = async () => {
    setIsAnalyzing(true);
    setScreenshotContext('');
    setScreenshot(null);
    setUserIntention(null);
    setOcr(null);
    if (onErrorChange) onErrorChange('');

    try {
      const result = await analyzeUserIntention(15);
      setUserIntention({
        id: Date.now().toString(),
        llm_user_intention: result.llm_user_intention || '',
        llm_user_state: result.llm_user_state || '',
        llm_keywords: result.llm_keywords,
        created_at: Date.now()
      });
    } catch (err) {
      console.error('Failed to analyze user intention:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (onErrorChange) onErrorChange(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTakeScreenshot = async (mode: 'window' | 'fullscreen') => {
    setIsAnalyzing(true);
    setScreenshotContext('');
    setScreenshot(null);
    setUserIntention(null);
    setOcr(null);
    if (onErrorChange) onErrorChange('');
    
    const resp = await takeScreenshot(mode);
    setScreenshot(resp.screenshot);
    if (resp.error && onErrorChange) {
      onErrorChange(resp.error);
    }
    setIsAnalyzing(false);
  };

  const handleGetScreenshotContext = async () => {
    setIsAnalyzing(true);
    setScreenshotContext('');
    setScreenshot(null);
    setUserIntention(null);
    setOcr(null);
    if (onErrorChange) onErrorChange('');
    
    try {
      const resp = await getScreenshotsContext();
      if (!resp) {
        if (onErrorChange) onErrorChange('No screenshot context available');
      } else {
        setScreenshotContext(resp);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (onErrorChange) onErrorChange(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGetScreenshotOCR = async () => {
    setIsAnalyzing(true);
    setScreenshotContext('');
    setScreenshot(null);
    setUserIntention(null);
    setOcr(null);
    if (onErrorChange) onErrorChange('');
    
    try {
      const resp = await getScreenshotOCR();
      if (!resp) {
        if (onErrorChange) onErrorChange('No OCR available');
      } else {
        setOcr(resp);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (onErrorChange) onErrorChange(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <MeshGradient
          speed={0.5}
          colors={["#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0"]}
          distortion={0.4}
          swirl={0.05}
          grainMixer={0}
          grainOverlay={0}
          className="inset-0 sticky top-0"
          style={{ height: "100%", width: "100%" }}
        />
      </div>
      <div className="relative z-10">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            {isAnalyzing ? (
              <div className="flex items-center text-sm text-muted-foreground pt-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {currentAction}...
              </div>
            ) : (
              'Choose an action to perform'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center flex-col space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={isAnalyzing}
              onClick={() => {
                handleTakeScreenshot('window');
                setCurrentAction('screenshot');
              }}
            >
              <Camera className="h-4 w-4" />
              Get Active Window
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={isAnalyzing}
              onClick={() => {
                handleAnalyzeUserIntention();
                setCurrentAction('analyze');
              }}
            >
              <Brain className="h-4 w-4" />
              Analyze User Intention
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={isAnalyzing}
              onClick={() => {
                handleGetScreenshotOCR();
                setCurrentAction('ocr');
              }}
            >
              <TextSelect className="h-4 w-4" />
              Active Window OCR
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={isAnalyzing}
              onClick={() => {
                handleGetScreenshotContext();
                setCurrentAction('screenshot_context');
              }}
            >
              <AppWindow className="h-4 w-4" />
              Get Screenshots Context
            </Button>
          </div>

          <ResultDisplay
            screenshot={screenshot}
            ocr={ocr}
            userIntention={userIntention}
            screenshotContext={screenshotContext}
            error={error}
          />
        </CardContent>
      </div>
    </Card>
  );
};

export default ActionPanel;
