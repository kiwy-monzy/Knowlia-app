import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, Volume2, Moon, Plus, X, Save } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { MeshGradient } from "@paper-design/shaders-react";

const NotificationSettings = () => {
  const { notificationSettings, updateNotificationSettings } = useSettings();
  const [customReminderTime, setCustomReminderTime] = useState('');

  const soundOptions = [
    { value: 'default', label: 'Default' },
    { value: 'alarm', label: 'Alarm' },
    { value: 'bell', label: 'Bell' },
    { value: 'chime', label: 'Chime' },
    { value: 'ding', label: 'Ding' },
    { value: 'none', label: 'None' },
  ];

  const handleAddCustomReminder = () => {
    const minutes = parseInt(customReminderTime);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error('Please enter a valid number of minutes');
      return;
    }

    const currentTimes = notificationSettings.eventReminders.defaultTimes;
    if (currentTimes.includes(minutes)) {
      toast.error('This reminder time already exists');
      return;
    }

    updateNotificationSettings({
      eventReminders: {
        ...notificationSettings.eventReminders,
        defaultTimes: [...currentTimes, minutes].sort((a, b) => b - a),
      },
    });
    setCustomReminderTime('');
    toast.success('Reminder time added');
  };

  const handleRemoveReminderTime = (minutes: number) => {
    updateNotificationSettings({
      eventReminders: {
        ...notificationSettings.eventReminders,
        defaultTimes: notificationSettings.eventReminders.defaultTimes.filter(t => t !== minutes),
      },
    });
    toast.success('Reminder time removed');
  };

  const formatReminderTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`;
    return `${Math.floor(minutes / 1440)} day`;
  };

  const handleSave = () => {
    toast.success('Notification settings saved');
  };

  return (
    <div className="p-6 pb-20 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">Manage your alerts and reminders</p>
      </div>

      {/* General Notifications */}
      <Card className="border-2 relative overflow-hidden">
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
              <Bell className="h-5 w-5" />
              General Notifications
            </CardTitle>
            <CardDescription>Control how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive all notifications</p>
              </div>
              <Switch
                checked={notificationSettings.enabled}
                onCheckedChange={(checked) => updateNotificationSettings({ enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Desktop Notifications</Label>
                <p className="text-sm text-muted-foreground">Show system notifications</p>
              </div>
              <Switch
                checked={notificationSettings.desktopNotifications}
                onCheckedChange={(checked) => updateNotificationSettings({ desktopNotifications: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Message Notifications</Label>
                <p className="text-sm text-muted-foreground">Notify on new messages</p>
              </div>
              <Switch
                checked={notificationSettings.messageNotifications}
                onCheckedChange={(checked) => updateNotificationSettings({ messageNotifications: checked })}
              />
            </div>

            <div className="space-y-3">
              <Label>Notification Sound</Label>
              <Select
                value={notificationSettings.sound}
                onValueChange={(value) => updateNotificationSettings({ sound: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {soundOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Volume</Label>
                <span className="text-sm text-muted-foreground">{notificationSettings.volume}%</span>
              </div>
              <div className="flex items-center gap-4">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[notificationSettings.volume]}
                  onValueChange={([value]) => updateNotificationSettings({ volume: value })}
                  max={100}
                  step={5}
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Event & Task Reminders */}
      <Card className="border-2 relative overflow-hidden">
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
              <Clock className="h-5 w-5" />
              Event & Task Reminders
            </CardTitle>
            <CardDescription>Set up automatic reminders for events and tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Event Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified before events</p>
              </div>
              <Switch
                checked={notificationSettings.eventReminders.enabled}
                onCheckedChange={(checked) =>
                  updateNotificationSettings({
                    eventReminders: { ...notificationSettings.eventReminders, enabled: checked },
                  })
                }
              />
            </div>

            {notificationSettings.eventReminders.enabled && (
              <>
                <div className="space-y-3">
                  <Label>Default Reminder Times</Label>
                  <p className="text-sm text-muted-foreground">
                    These reminders will be automatically added to new events
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {notificationSettings.eventReminders.defaultTimes.map((minutes) => (
                      <Badge
                        key={minutes}
                        variant="secondary"
                        className="gap-2 px-3 py-1.5 cursor-pointer hover:bg-destructive/20"
                        onClick={() => handleRemoveReminderTime(minutes)}
                      >
                        {formatReminderTime(minutes)} before
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Add Custom Reminder Time</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Minutes before event"
                      value={customReminderTime}
                      onChange={(e) => setCustomReminderTime(e.target.value)}
                      min="1"
                    />
                    <Button onClick={handleAddCustomReminder} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter minutes before event (e.g., 45 for 45 minutes before)
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Reminder Sound</Label>
                  <Select
                    value={notificationSettings.eventReminders.sound}
                    onValueChange={(value) =>
                      updateNotificationSettings({
                        eventReminders: { ...notificationSettings.eventReminders, sound: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {soundOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Reminder Volume</Label>
                    <span className="text-sm text-muted-foreground">
                      {notificationSettings.eventReminders.volume}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <Slider
                      value={[notificationSettings.eventReminders.volume]}
                      onValueChange={([value]) =>
                        updateNotificationSettings({
                          eventReminders: { ...notificationSettings.eventReminders, volume: value },
                        })
                      }
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Do Not Disturb */}
      <Card className="border-2 relative overflow-hidden">
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
              <Moon className="h-5 w-5" />
              Do Not Disturb
            </CardTitle>
            <CardDescription>Silence notifications during specific hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Do Not Disturb</Label>
                <p className="text-sm text-muted-foreground">Mute notifications during set hours</p>
              </div>
              <Switch
                checked={notificationSettings.doNotDisturb.enabled}
                onCheckedChange={(checked) =>
                  updateNotificationSettings({
                    doNotDisturb: { ...notificationSettings.doNotDisturb, enabled: checked },
                  })
                }
              />
            </div>

            {notificationSettings.doNotDisturb.enabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={notificationSettings.doNotDisturb.startTime}
                      onChange={(e) =>
                        updateNotificationSettings({
                          doNotDisturb: { ...notificationSettings.doNotDisturb, startTime: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={notificationSettings.doNotDisturb.endTime}
                      onChange={(e) =>
                        updateNotificationSettings({
                          doNotDisturb: { ...notificationSettings.doNotDisturb, endTime: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </>
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

export default NotificationSettings;
