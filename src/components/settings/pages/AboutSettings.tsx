import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Info, Download, ExternalLink, Github, Heart, RefreshCw, Zap, Package, Calendar, Code, Shield } from 'lucide-react';
import { toast } from 'sonner';
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
      }, 2000);
    } catch (error) {
      console.error('Update failed:', error);
      toast.error(`Update failed: ${error instanceof Error ? error.message : String(error)}`, { 
        id: toastId 
      });
    }
  };

  return (
    <div className="p-6 pb-18 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">About {appName}</h2>
          <p className="text-gray-600 mt-1">Application information and updates</p>
        </div>
        <button
          onClick={checkForUpdates}
          disabled={isChecking}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-blue-600 ${isChecking ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-blue-700">
            {isChecking ? 'Checking...' : 'Check Updates'}
          </span>
        </button>
      </div>

      {/* Application Information Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Application Information</span>
          </h3>
          {updateInfo && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600 font-medium">Update Available</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Application Name</p>
              <p className="font-medium text-gray-900">{appName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Version</p>
              <p className="font-mono font-medium text-gray-900">v{appVersion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Build Date</p>
              <p className="font-medium text-gray-900">{new Date(buildDate).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Platform</p>
              <p className="font-medium text-gray-900">{navigator.platform}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Architecture</p>
              <p className="font-medium text-gray-900">{navigator.userAgent.includes('x64') ? 'x64' : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="font-medium text-green-600">Running</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Update Information Card */}
      {updateInfo && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-900 flex items-center space-x-2">
              <Download className="w-5 h-5 text-green-600" />
              <span>Update Available</span>
            </h3>
            <span className="text-sm font-medium text-green-700">v{updateInfo.version}</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-green-700 mb-2">Release Notes:</p>
              <p className="text-sm text-green-800 bg-white rounded-lg p-3 border border-green-200">
                {updateInfo.body || 'No release notes available.'}
              </p>
            </div>
            
            {updateInfo.date && (
              <div>
                <p className="text-sm text-green-700">Release Date:</p>
                <p className="font-medium text-green-900">{new Date(updateInfo.date).toLocaleDateString()}</p>
              </div>
            )}
            
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => handleUpdate(updateInfo)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Update Now</span>
              </button>
              <button
                onClick={() => setUpdateInfo(null)}
                className="px-4 py-2 bg-white text-green-700 rounded-lg border border-green-300 hover:bg-green-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Credits Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Heart className="w-5 h-5 text-red-500" />
            <span>Credits</span>
          </h3>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Built with passion using modern web technologies. This application is powered by 
            Tauri, React, and TypeScript to provide a seamless cross-platform experience.
          </p>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>© 2026 {appName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutSettings;