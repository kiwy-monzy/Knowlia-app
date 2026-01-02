import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Shield, Lock, UserX, Save } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { MeshGradient } from "@paper-design/shaders-react";

const PrivacySettings = () => {
  const { privacySettings, updatePrivacySettings } = useSettings();

  const handleSave = () => {
    toast.success('Privacy settings saved');
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Privacy & Security</h1>
        <p className="text-muted-foreground">Control your data and security preferences</p>
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
            <Shield className="h-5 w-5" />
            Data & Privacy
          </CardTitle>
          <CardDescription>Manage how your data is used</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Data Sharing</Label>
              <p className="text-sm text-muted-foreground">
                Share usage data to improve the app
              </p>
            </div>
            <Switch
              checked={privacySettings.dataSharing}
              onCheckedChange={(checked) => updatePrivacySettings({ dataSharing: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Allow anonymous analytics collection
              </p>
            </div>
            <Switch
              checked={privacySettings.analytics}
              onCheckedChange={(checked) => updatePrivacySettings({ analytics: checked })}
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
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Enhance your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security
              </p>
            </div>
            <Switch
              checked={privacySettings.twoFactorAuth}
              onCheckedChange={(checked) => updatePrivacySettings({ twoFactorAuth: checked })}
            />
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
            <Button variant="outline" className="w-full">
              Manage Security Keys
            </Button>
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
            <UserX className="h-5 w-5" />
            Blocked Users
          </CardTitle>
          <CardDescription>Manage blocked users</CardDescription>
        </CardHeader>
        <CardContent>
          {privacySettings.blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No blocked users
            </p>
          ) : (
            <div className="space-y-2">
              {privacySettings.blockedUsers.map((userId) => (
                <div key={userId} className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{userId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updatePrivacySettings({
                        blockedUsers: privacySettings.blockedUsers.filter(id => id !== userId),
                      });
                      toast.success('User unblocked');
                    }}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
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

export default PrivacySettings;
