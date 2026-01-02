import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Terminal,
  Brain,
  Target,
  Tag,
  Camera,
  FileText,
  Bot,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { MeshGradient } from "@paper-design/shaders-react";

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

interface ResultDisplayProps {
  screenshot: Screenshot | null;
  userIntention: UserIntentionHistory | null;
  screenshotContext: string | null;
  ocr: string | null;
  error?: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  screenshot,
  userIntention,
  screenshotContext,
  ocr,
  error,
}) => {
  const [chosenArm, setChosenArm] = useState<number | null>(null);
  const [armError, setArmError] = useState<string | null>(null);
  const [armLoading, setArmLoading] = useState(false);

  const getContextualBanditArm = async () => {
    if (!userIntention?.id) return;

    setArmLoading(true);
    setArmError(null);
    setChosenArm(null);

    try {
      const arm = await invoke<number>('get_choosen_arm_from_user_intention_id', {
        userIntentionId: userIntention.id,
        fromTest: true,
      });
      setChosenArm(arm);
    } catch (err) {
      setArmError(err as string);
    } finally {
      setArmLoading(false);
    }
  };

  return (
    <Card className="min-h-[200px] max-h-[400px] w-full">
      <div className="relative overflow-hidden">
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
            <CardTitle>Result</CardTitle>
            <CardDescription>
              {userIntention ? (
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Brain className="h-4 w-4" />
                  User Intention Results
                </div>
              ) : screenshot ? (
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Camera className="h-4 w-4" />
                  Screenshot Analysis
                </div>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-auto">
            {error ? (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : screenshot ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {screenshot.screenshot_url && (
                    <img
                      src={screenshot.screenshot_url}
                      alt="Screenshot preview"
                      className="max-h-64 w-full rounded-md border object-contain"
                    />
                  )}

                  <div className="text-center text-sm text-muted-foreground">
                    <p>
                      {screenshot.title} ({screenshot.process_name})
                    </p>
                  </div>
                </div>

                {screenshot.llm_description && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <FileText className="h-4 w-4" />
                      Description:
                    </div>
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      {screenshot.llm_description}
                    </div>
                  </div>
                )}

                {screenshot.llm_keywords && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Tag className="h-4 w-4" />
                      Keywords:
                    </div>
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      {screenshot.llm_keywords}
                    </div>
                  </div>
                )}

                {screenshot.llm_category && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Target className="h-4 w-4" />
                      Category:
                    </div>
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      {screenshot.llm_category}
                    </div>
                  </div>
                )}
              </div>
            ) : ocr ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Target className="h-4 w-4" />
                  OCR Result:
                </div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md break-keep whitespace-break-spaces">
                  {ocr}
                </div>
              </div>
            ) : screenshotContext ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Target className="h-4 w-4" />
                  Context (for Suggestions):
                </div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md break-keep whitespace-break-spaces">
                  {screenshotContext}
                </div>
              </div>
            ) : userIntention ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Target className="h-4 w-4" />
                    Intention:
                  </div>
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {userIntention.llm_user_intention}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-sm">State:</div>
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {userIntention.llm_user_state}
                  </div>
                </div>

                {userIntention.llm_keywords && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Tag className="h-4 w-4" />
                      Keywords:
                    </div>
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      {userIntention.llm_keywords}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Analyzed at: {new Date(
                    typeof userIntention.created_at === 'string' 
                      ? userIntention.created_at 
                      : userIntention.created_at * 1000
                  ).toLocaleString()}
                </div>

                {userIntention.id && (
                  <div className="pt-4 border-t">
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={getContextualBanditArm}
                        disabled={armLoading}
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        {armLoading ? 'Analyzing...' : 'Get Contextual Bandit Decision'}
                      </Button>

                      {chosenArm !== null && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Bot className="h-4 w-4" />
                            Contextual Bandit Decision:
                          </div>
                          <div className="text-sm p-3 bg-muted rounded-md">
                            <span className="font-medium">
                              Arm {chosenArm}: {chosenArm === 0 ? 'No Assist' : 'Assist'}
                            </span>
                            <div className="text-xs text-muted-foreground mt-1">
                              The contextual bandit recommends {chosenArm === 0
                                ? 'not providing assistance'
                                : 'providing assistance'} based on current context.
                            </div>
                          </div>
                        </div>
                      )}

                      {armError && (
                        <Alert variant="destructive">
                          <Terminal className="h-4 w-4" />
                          <AlertTitle>Contextual Bandit Error</AlertTitle>
                          <AlertDescription>{armError}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </div>
      </div>
    </Card>
  );
};

export default ResultDisplay;
