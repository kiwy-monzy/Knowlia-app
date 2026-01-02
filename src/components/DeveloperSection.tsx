import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Folder, Bird } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { Switch } from '@/components/ui/switch';
import { getAllWindows, Window } from '@tauri-apps/api/window';
import ActionPanel from './ActionPanel';

const DeveloperSection: React.FC = () => {
  const [error, setError] = useState<string>('');
  const [avatarWindow, setAvatarWindow] = useState<Window | null>(null);
  const [avatarWindowDecorations, setAvatarWindowDecorations] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [userStateInput, setUserStateInput] = useState('');
  const [userIntentionInput, setUserIntentionInput] = useState('');
  const [appDescriptionInput, setAppDescriptionInput] = useState('');
  const [isGeneratingFakeSuggestion, setIsGeneratingFakeSuggestion] = useState(false);
  const [isAvatarRestarting, setIsAvatarRestarting] = useState(false);
  const [appPath, setAppPath] = useState<string>('');

  useEffect(() => {
    const initializeWindows = async () => {
      const windows = await getAllWindows();
      const avatarWin = windows.find((window) => window.label === 'avatar') ?? null;
      setAvatarWindow(avatarWin);
      if (avatarWin) {
        const decorated = await avatarWin.isDecorated();
        setAvatarWindowDecorations(decorated);
      }
    };

    const getAppPath = async () => {
      try {
        const path = await invoke('get_app_path') as string;
        setAppPath(path);
      } catch (err) {
        console.error('Failed to get app path:', err);
      }
    };

    initializeWindows();
    getAppPath();
  }, []);

  useEffect(() => {
    if (avatarWindow) {
      avatarWindow.setDecorations(avatarWindowDecorations);
    }
  }, [avatarWindowDecorations, avatarWindow]);

  const handleRestartBandit = async () => {
    setIsRestarting(true);
    try {
      await invoke('restart_contextual_bandit');
      setShowRestartDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Failed to restart bandit:', err);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleGenerateFakeSuggestion = async () => {
    if (!userStateInput.trim() || !userIntentionInput.trim()) {
      setError('Both userState and userIntention are required');
      return;
    }

    setIsGeneratingFakeSuggestion(true);
    setError('');

    try {
      await invoke('generate_fake_suggestion', {
        userState: userStateInput,
        userIntention: userIntentionInput,
        appDescription: appDescriptionInput,
      });
    } catch (err) {
      console.error('Failed to generate fake suggestion:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingFakeSuggestion(false);
    }
  };

  const handleRestartAvatar = async () => {
    setIsAvatarRestarting(true);
    try {
      await invoke('close_avatar_window');
      setTimeout(async () => {
        await invoke('create_avatar_window');
        setIsAvatarRestarting(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to restart avatar:', err);
      setError(err instanceof Error ? err.message : String(err));
      setIsAvatarRestarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Testing</h2>
        <p className="text-muted-foreground">Test Loyca.AI logic</p>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <ActionPanel error={error} onErrorChange={setError} />
        </div>

        <div className="lg:mt-8">
          {/* Generate Fake Suggestion */}
          <div className="p-4 rounded-lg border bg-white space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Generate Fake Suggestion</h4>
              <p className="text-sm text-muted-foreground">
                Test the suggestion generator with custom state and user intention
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="user-state" className="text-sm font-medium">User State</label>
                <input
                  id="user-state"
                  type="text"
                  value={userStateInput}
                  onChange={(e) => setUserStateInput(e.target.value)}
                  placeholder="e.g., focused"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="user-intention" className="text-sm font-medium">User Intent</label>
                <input
                  id="user-intention"
                  type="text"
                  value={userIntentionInput}
                  onChange={(e) => setUserIntentionInput(e.target.value)}
                  placeholder="e.g., Creating a web page"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="user-screenshot" className="text-sm font-medium">Screenshot description</label>
                <input
                  id="user-screenshot"
                  type="text"
                  value={appDescriptionInput}
                  onChange={(e) => setAppDescriptionInput(e.target.value)}
                  placeholder="e.g., A screenshot of a web page"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button
                onClick={handleGenerateFakeSuggestion}
                disabled={isGeneratingFakeSuggestion || !userStateInput.trim() || !userIntentionInput.trim()}
                className="w-full"
              >
                {isGeneratingFakeSuggestion ? 'Generating...' : 'Generate Fake Suggestion'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal line separator */}
      <hr className="border-t border-border" />

      {/* Controls section at the bottom */}
      <div className="max-w-2xl mx-auto space-y-2 z-30">
        <h3 className="text-xl font-semibold">Controls</h3>

        {/* Avatar decoration switch */}
        <div className="flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Avatar Window Decorations</h4>
            <p className="text-sm text-muted-foreground">
              Toggle window decorations for the avatar window
            </p>
          </div>
          <Switch checked={avatarWindowDecorations} onCheckedChange={setAvatarWindowDecorations} />
        </div>

        {/* Open App folder */}
        <div className="flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Open Loyca.ai folder</h4>
            <p className="text-sm text-muted-foreground">
              Open the Loyca.ai folder in the file explorer
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => appPath && openPath(appPath)}
            disabled={!appPath}
            className="w-36"
          >
            <Folder className="w-4 h-4 mr-2" />
            Open Folder
          </Button>
        </div>

        {/* Restart bandit button */}
        <div className="z-30 flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Contextual Bandit</h4>
            <p className="text-sm text-muted-foreground">
              Reset the bandit model and clear all statistics
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowRestartDialog(true)}
            disabled={isRestarting}
            className="w-36"
          >
            <RotateCcw className="w-4 h-4" />
            {isRestarting ? 'Restarting...' : 'Restart Bandit'}
          </Button>
        </div>

        {/* Restart avatar window */}
        <div className="z-30 flex items-center justify-between px-4 py-2 rounded-lg border bg-white">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Restart Avatar</h4>
            <p className="text-sm text-muted-foreground">Reload the avatar display</p>
          </div>
          <Button
            variant="default"
            disabled={isAvatarRestarting}
            onClick={handleRestartAvatar}
            className="w-36"
          >
            <Bird className="w-4 h-4" />
            Restart Avatar
          </Button>
        </div>
      </div>

      {/* Restart bandit confirmation modal */}
      {showRestartDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Restart Contextual Bandit</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete all bandit statistics and the trained model. A new model will be initialized from scratch. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRestartDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRestartBandit}>
                Restart
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperSection;
