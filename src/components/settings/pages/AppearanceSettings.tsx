import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Palette, Sun, Moon, Monitor, Type, Layout, Save } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { MeshGradient } from "@paper-design/shaders-react";

const AppearanceSettings = () => {
  const { appearanceSettings, updateAppearanceSettings } = useSettings();

  const handleSave = () => {
    toast.success('Appearance settings saved');
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Appearance Settings</h1>
        <p className="text-muted-foreground">Customize the look and feel of your app</p>
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
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => updateAppearanceSettings({ theme: 'light' })}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                appearanceSettings.theme === 'light'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Sun className="h-8 w-8" />
              <span className="font-medium">Light</span>
            </button>

            <button
              onClick={() => updateAppearanceSettings({ theme: 'dark' })}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                appearanceSettings.theme === 'dark'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Moon className="h-8 w-8" />
              <span className="font-medium">Dark</span>
            </button>

            <button
              onClick={() => updateAppearanceSettings({ theme: 'auto' })}
              className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${
                appearanceSettings.theme === 'auto'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Monitor className="h-8 w-8" />
              <span className="font-medium">Auto</span>
            </button>
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
            <Type className="h-5 w-5" />
            Typography
          </CardTitle>
          <CardDescription>Adjust text size and readability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Select
              value={appearanceSettings.fontSize}
              onValueChange={(value: any) => updateAppearanceSettings({ fontSize: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 border rounded-lg">
            <p className={`${
              appearanceSettings.fontSize === 'small' ? 'text-sm' :
              appearanceSettings.fontSize === 'large' ? 'text-lg' :
              'text-base'
            }`}>
              This is a preview of how text will appear with your selected font size.
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
            <Layout className="h-5 w-5" />
            Layout
          </CardTitle>
          <CardDescription>Customize the interface density</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>UI Density</Label>
            <Select
              value={appearanceSettings.density}
              onValueChange={(value: any) => updateAppearanceSettings({ density: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="spacious">Spacious</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {appearanceSettings.density === 'compact' && 'More content in less space'}
              {appearanceSettings.density === 'comfortable' && 'Balanced spacing and content'}
              {appearanceSettings.density === 'spacious' && 'More breathing room, less content'}
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
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>Choose your accent color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            {[
              { name: 'Default', color: 'bg-blue-500' },
              { name: 'Red', color: 'bg-red-500' },
              { name: 'Green', color: 'bg-green-500' },
              { name: 'Purple', color: 'bg-purple-500' },
              { name: 'Orange', color: 'bg-orange-500' },
              { name: 'Pink', color: 'bg-pink-500' },
            ].map((scheme) => (
              <button
                key={scheme.name}
                onClick={() => updateAppearanceSettings({ colorScheme: scheme.name.toLowerCase() })}
                className={`aspect-square rounded-lg ${scheme.color} ${
                  appearanceSettings.colorScheme === scheme.name.toLowerCase()
                    ? 'ring-4 ring-primary ring-offset-2'
                    : 'hover:scale-110'
                } transition-all`}
                title={scheme.name}
              />
            ))}
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

export default AppearanceSettings;
