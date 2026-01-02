import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Code, Database, Zap, Trash2, Save } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { MeshGradient } from "@paper-design/shaders-react";

const AdvancedSettings = () => {
  const { advancedSettings, updateAdvancedSettings, systemSettings, updateSystemSettings } = useSettings();

  const handleClearCache = () => {
    toast.success('Cache cleared successfully');
  };

  const handleSave = () => {
    toast.success('Advanced settings saved');
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Advanced Settings</h1>
        <p className="text-muted-foreground">Configure advanced options and developer features</p>
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
            <Code className="h-5 w-5" />
            Developer Options
          </CardTitle>
          <CardDescription>Enable features for developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Developer Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable advanced debugging features
              </p>
            </div>
            <Switch
              checked={advancedSettings.developerMode}
              onCheckedChange={(checked) => updateAdvancedSettings({ developerMode: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Debug Mode</Label>
              <p className="text-sm text-muted-foreground">
                Show detailed logs and error messages
              </p>
            </div>
            <Switch
              checked={advancedSettings.debugMode}
              onCheckedChange={(checked) => updateAdvancedSettings({ debugMode: checked })}
            />
          </div>
        </CardContent>
        </div>
      </Card>

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
            <Database className="h-5 w-5" />
            Storage & Cache
          </CardTitle>
          <CardDescription>Manage app data and cache</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Cache Size Limit (MB)</Label>
            <Input
              type="number"
              value={advancedSettings.cacheSize}
              onChange={(e) => updateAdvancedSettings({ cacheSize: parseInt(e.target.value) })}
              min="100"
              max="5000"
            />
            <p className="text-sm text-muted-foreground">
              Current cache size: ~{Math.floor(advancedSettings.cacheSize * 0.6)} MB
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Cleanup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically clean old cache files
              </p>
            </div>
            <Switch
              checked={advancedSettings.autoCleanup}
              onCheckedChange={(checked) => updateAdvancedSettings({ autoCleanup: checked })}
            />
          </div>

          <Button variant="destructive" onClick={handleClearCache} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Clear Cache Now
          </Button>
        </CardContent>
        </div>
      </Card>

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
            <Zap className="h-5 w-5" />
            Performance
          </CardTitle>
          <CardDescription>Optimize app performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Performance Mode</Label>
            <Select
              value={advancedSettings.performanceMode}
              onValueChange={(value: any) => updateAdvancedSettings({ performanceMode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="battery">Battery Saver</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="performance">High Performance</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {advancedSettings.performanceMode === 'battery' && 'Reduces CPU usage and animations'}
              {advancedSettings.performanceMode === 'balanced' && 'Optimal balance of performance and efficiency'}
              {advancedSettings.performanceMode === 'performance' && 'Maximum performance, higher resource usage'}
            </p>
          </div>
        </CardContent>
        </div>
      </Card>

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
            <SettingsIcon className="h-5 w-5" />
            System Integration
          </CardTitle>
          <CardDescription>Configure system-level settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Launch on Startup</Label>
              <p className="text-sm text-muted-foreground">
                Start app when system boots
              </p>
            </div>
            <Switch
              checked={systemSettings.launchOnStartup}
              onCheckedChange={(checked) => updateSystemSettings({ launchOnStartup: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Minimize to System Tray</Label>
              <p className="text-sm text-muted-foreground">
                Keep app running in background
              </p>
            </div>
            <Switch
              checked={systemSettings.minimizeToTray}
              onCheckedChange={(checked) => updateSystemSettings({ minimizeToTray: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={systemSettings.language}
              onValueChange={(value) => updateSystemSettings({ language: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        </div>
      </Card>

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
          <CardTitle>Network Settings</CardTitle>
          <CardDescription>Configure proxy and network options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Proxy</Label>
              <p className="text-sm text-muted-foreground">
                Route traffic through proxy server
              </p>
            </div>
            <Switch
              checked={systemSettings.proxyEnabled}
              onCheckedChange={(checked) => updateSystemSettings({ proxyEnabled: checked })}
            />
          </div>

          {systemSettings.proxyEnabled && (
            <div className="space-y-2">
              <Label>Proxy URL</Label>
              <Input
                placeholder="http://proxy.example.com:8080"
                value={systemSettings.proxyUrl}
                onChange={(e) => updateSystemSettings({ proxyUrl: e.target.value })}
              />
            </div>
          )}
        </CardContent>
        </div>
      </Card>

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
          <CardTitle>Backup & Restore</CardTitle>
          <CardDescription>Manage your data backups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Backup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup your data
              </p>
            </div>
            <Switch
              checked={systemSettings.autoBackup}
              onCheckedChange={(checked) => updateSystemSettings({ autoBackup: checked })}
            />
          </div>

          {systemSettings.autoBackup && (
            <div className="space-y-2">
              <Label>Backup Interval (days)</Label>
              <Input
                type="number"
                value={systemSettings.backupInterval}
                onChange={(e) => updateSystemSettings({ backupInterval: parseInt(e.target.value) })}
                min="1"
                max="30"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              Export Data
            </Button>
            <Button variant="outline" className="flex-1">
              Import Data
            </Button>
          </div>
        </CardContent>
        </div>
      </Card>

      <Button onClick={handleSave} className="gap-2">
        <Save className="h-4 w-4" />
        Save Settings
      </Button>
    </div>
  );
};

export default AdvancedSettings;
