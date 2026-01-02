import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, Download, ExternalLink, Github, Heart, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { MeshGradient } from "@paper-design/shaders-react";

import { useState } from 'react';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { exit, relaunch } from '@tauri-apps/plugin-process';
import packageJson from '../../../../package.json';

const AboutSettings = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    date?: string;
    body?: string;
  } | null>(null);

  const appVersion = packageJson.version;
  const appName = packageJson.name;
  const buildDate = import.meta.env.BUILD_DATE || new Date().toISOString();

  const checkForUpdates = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const update = await check();
      //console.log(update);
      if (update) {
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body
        });
        toast.success(`Update available: v${update.version}`, {
          description: update.body,
          action: {
            label: 'Update Now',
            onClick: () => handleUpdate({
              version: update.version,
              date: update.date,
              body: update.body
            })
          }
        });
      } else {
        setUpdateInfo(null);
        toast.success('You are running the latest version');
      }
    } catch (error) {
      //console.error('Update check failed:', error);
      toast.error('Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

const handleUpdate = async (updateInfo: {
  version: string;
  date?: string;
  body?: string;
} | null) => {
  if (!updateInfo) return;
  
  const update = await check();
  if (!update) return;
  
  // Show initial download toast and store the toast ID
  const toastId = toast.loading('Preparing update...');
  
  try {
    //console.log(`Found update ${update.version} from ${update.date} with notes: ${update.body}`);
    
    // Download and install the update
    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case 'Started':
          toast.loading('Starting download...', { id: toastId });
          break;
          
        case 'Progress':
          toast.loading('Downloading update...', { 
            id: toastId 
          });
          break;
          
        case 'Finished':
          toast.loading('Installing update...', { id: toastId });
          break;
      }
    });
    
    // If we get here, installation was successful
    toast.success('Update installed! Restarting application...', { id: toastId });
    
    // Give a small delay to show the success message before restarting
    setTimeout(() => {
      relaunch();
    }, 1000);
    
  } catch (error) {
    console.error('Update failed:', error);
    toast.error(`Update failed: ${error instanceof Error ? error.message : String(error)}`, { 
      id: toastId 
    });
  }
};

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">About {appName}</h1>
        <p className="text-muted-foreground">
          Version {appVersion} • Built on {new Date(buildDate).toLocaleDateString()}
        </p>
      </div>

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
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Application Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Application</p>
              <p>{appName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Version</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">v{appVersion}</Badge>
                {updateInfo && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                    v{updateInfo.version} available
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {updateInfo && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <h3 className="font-medium text-blue-800 dark:text-blue-200">Update Available</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Version {updateInfo.version} • {updateInfo.date && new Date(updateInfo.date).toLocaleDateString()}
              </p>
              {updateInfo.body && (
                <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300">
                  {updateInfo.body}
                </div>
              )}
              <Button 
                size="sm" 
                className="mt-3 bg-blue-600 hover:bg-blue-700"
                onClick={() => updateInfo && handleUpdate(updateInfo)}
              >
                <Download className="mr-2 h-4 w-4" />
                Install Update
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={checkForUpdates}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check for Updates
                </>
              )}
            </Button>
          </div>
        </CardContent>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" fill="currentColor" />
            About KlassKall
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none">
            <p>
              KlassKall is the powerful decentralized networking engine that powers Knowlia, 
              enabling secure, private communication without relying on internet infrastructure.
            </p>
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-muted/20 rounded-lg">
                <h4 className="font-medium text-foreground">Core Features</h4>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li><span className="font-medium">Peer-to-Peer Mesh:</span> Direct device-to-device connections without central servers</li>
                  <li><span className="font-medium">End-to-End Encryption:</span> All communications are secured with military-grade encryption</li>
                  <li><span className="font-medium">Offline-First:</span> Works without internet via Wi-Fi Direct, Bluetooth, or local networks</li>
                  <li><span className="font-medium">Self-Healing Network:</span> Automatically routes around network disruptions</li>
                  <li><span className="font-medium">Zero Configuration:</span> Automatically discovers nearby devices</li>
                </ul>
              </div>

              <div className="p-4 bg-muted/20 rounded-lg">
                <h4 className="font-medium text-foreground">How It Works</h4>
                <p className="text-sm mt-1">
                  KlassKall creates a decentralized mesh network where each device acts as both a client and a router, 
                  relaying messages for other devices to extend the network's reach. Messages are encrypted 
                  and routed through the most efficient path available.
                </p>
              </div>
            </div>

            <div className="mt-6 space-x-3">
              <Button variant="outline" asChild>
                <a 
                  href="https://knowlia.site" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Learn more about Knowlia
                </a>
              </Button>
            </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium">
              {typeof window !== 'undefined' ? window.navigator.platform : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Language</span>
            <span className="font-medium">
              {typeof window !== 'undefined' ? window.navigator.language : 'en-US'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Online Status</span>
            <Badge variant={typeof window !== 'undefined' && window.navigator.onLine ? 'default' : 'secondary'}>
              {typeof window !== 'undefined' && window.navigator.onLine ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>© 2025 {appName}. All rights reserved.</p>
        <p className="mt-1">Made with ❤️ for the community</p>
      </div>
    </div>
  );
};

export default AboutSettings;
