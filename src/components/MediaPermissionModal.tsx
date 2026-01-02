import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, Video, Monitor, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: string;
}

interface MediaPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  permissions: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };
  onPermissionsChange: (permissions: { audio: boolean; video: boolean; screen: boolean }) => void;
  onConfirm: () => void;
}

const MediaPermissionModal: React.FC<MediaPermissionModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  permissions,
  onPermissionsChange,
  onConfirm,
}) => {
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Enumerate media devices when modal opens
  useEffect(() => {
    if (open) {
      enumerateDevices();
    }
  }, [open]);

  const enumerateDevices = async () => {
    setIsLoading(true);
    try {
      // Request temporary permissions to enumerate devices
      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      // Get device list
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Filter and categorize devices
      const audioInputDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }));
      
      const videoInputDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }));
      
      setAudioDevices(audioInputDevices);
      setVideoDevices(videoInputDevices);
      
      // Select first device by default
      if (audioInputDevices.length > 0) {
        setSelectedAudioDevice(audioInputDevices[0].deviceId);
      }
      if (videoInputDevices.length > 0) {
        setSelectedVideoDevice(videoInputDevices[0].deviceId);
      }
      
      // Clean up temporary stream
      tempStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Error enumerating devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScreenShareSources = async () => {
    try {
      const sources = await (navigator.mediaDevices as any).getDisplayMedia({
        video: {
          displaySurface: 'monitor'
        },
        audio: false
      });
      
      // Get screen info
      const screenInfo = {
        id: 'screen-share',
        label: 'Screen Share',
        kind: 'screen'
      };
      
      // Stop the preview stream
      sources.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      
      return [screenInfo];
    } catch (error) {
      console.error('Error getting screen share sources:', error);
      return [];
    }
  };

  const handlePermissionToggle = (type: 'audio' | 'video' | 'screen') => {
    onPermissionsChange({
      ...permissions,
      [type]: !permissions[type],
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleConfirm = () => {
    // Prepare session data with selected devices
    const sessionData = {
      audioDevice: permissions.audio ? selectedAudioDevice : null,
      videoDevice: permissions.video ? selectedVideoDevice : null,
      screenShare: permissions.screen,
      permissions
    };
    
    console.log('Starting RTC session with devices:', sessionData);
    
    onConfirm();
    onOpenChange(false);
  };

  const getSelectedDeviceLabel = (devices: MediaDevice[], deviceId: string) => {
    const device = devices.find(d => d.deviceId === deviceId);
    return device?.label || 'Select Device';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {/* Audio Permission */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${permissions.audio ? 'bg-blue-100' : 'bg-muted'}`}>
                  <Mic className={`h-4 w-4 ${permissions.audio ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Microphone Access</p>
                  <p className="text-sm text-muted-foreground">Allow audio input for voice calls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {permissions.audio && audioDevices.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2">
                        <ChevronDown className="h-3 w-3 mr-1" />
                        {getSelectedDeviceLabel(audioDevices, selectedAudioDevice).slice(0, 15)}...
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {audioDevices.map((device) => (
                        <DropdownMenuItem 
                          key={device.deviceId}
                          onClick={() => setSelectedAudioDevice(device.deviceId)}
                        >
                          {device.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePermissionToggle('audio')}
                  className={`h-8 w-8 p-0 ${permissions.audio ? 'bg-blue-100 text-blue-600' : 'bg-muted'}`}
                >
                  {permissions.audio && <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Video Permission */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${permissions.video ? 'bg-blue-100' : 'bg-muted'}`}>
                  <Video className={`h-4 w-4 ${permissions.video ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Camera Access</p>
                  <p className="text-sm text-muted-foreground">Allow video input for video calls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {permissions.video && videoDevices.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2">
                        <ChevronDown className="h-3 w-3 mr-1" />
                        {getSelectedDeviceLabel(videoDevices, selectedVideoDevice).slice(0, 15)}...
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {videoDevices.map((device) => (
                        <DropdownMenuItem 
                          key={device.deviceId}
                          onClick={() => setSelectedVideoDevice(device.deviceId)}
                        >
                          {device.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePermissionToggle('video')}
                  className={`h-8 w-8 p-0 ${permissions.video ? 'bg-blue-100 text-blue-600' : 'bg-muted'}`}
                >
                  {permissions.video && <Check className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Screen Share Permission */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${permissions.screen ? 'bg-blue-100' : 'bg-muted'}`}>
                  <Monitor className={`h-4 w-4 ${permissions.screen ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Screen Sharing</p>
                  <p className="text-sm text-muted-foreground">Allow sharing your screen</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePermissionToggle('screen')}
                className={`h-8 w-8 p-0 ${permissions.screen ? 'bg-blue-100 text-blue-600' : 'bg-muted'}`}
              >
                {permissions.screen && <Check className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button 
            onClick={handleConfirm}
            disabled={!permissions.audio && !permissions.video && !permissions.screen}
          >
            Start Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPermissionModal;
