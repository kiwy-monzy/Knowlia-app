import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, X, Upload, User, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { processProfileImage, validateImageDataUrl } from '@/utils/imageUtils';
import { MeshGradient } from "@paper-design/shaders-react";

const ProfileSettings = () => {
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(''); // Base64 encoded image
  const [about, setAbout] = useState('');
  const [college, setCollege] = useState('');
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store original values to detect changes
  const [originalData, setOriginalData] = useState({
    name: '',
    profile: '',
    about: '',
    college: '',
    regNo: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  // Refresh profile data when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (!hasChanges) {
        loadProfile();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [hasChanges]);

  // Check if data has changed
  useEffect(() => {
    const changed = 
      name !== originalData.name ||
      profile !== originalData.profile ||
      about !== originalData.about ||
      college !== originalData.college ||
      regNo !== originalData.regNo;
    setHasChanges(changed);
  }, [name, profile, about, college, regNo, originalData]);

  const loadProfile = async () => {
    try {
      //console.log('Loading profile...');
      const profileJson = await invoke<string>('user_profile');
      //console.log('Raw profile JSON:', profileJson);
      const profileData = JSON.parse(profileJson);
      //console.log('Parsed profile data:', profileData);
      
      const loadedData = {
        name: profileData.name || '',
        profile: profileData.profile || '',
        about: profileData.about || '',
        college: profileData.college || '',
        regNo: profileData.reg_no || ''
      };

      //console.log('Setting profile state:', loadedData);
      setName(loadedData.name);
      setProfile(loadedData.profile);
      setAbout(loadedData.about);
      setCollege(loadedData.college);
      setRegNo(loadedData.regNo);
      setOriginalData(loadedData);
    } catch (error) {
      //console.error('Failed to load profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Image upload started:', file.name, file.type, file.size);

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size
    const maxSize = 15 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`File too large: ${Math.round(file.size / 1024)}KB (max: ${maxSize / 1024}KB)`);
      return;
    }

    try {
      console.log('Processing image...');
      // Process and validate the image
      const processedImage = await processProfileImage(file);
      console.log('Image processed successfully, length:', processedImage.length);
      
      setProfile(processedImage);
      toast.success('Image uploaded successfully');
      
      // Clear the file input
      if (event.target) {
        event.target.value = '';
      }
    } catch (error) {
      console.error('Image processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
      
      // Clear the file input on error
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleChangeAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (getAvatarSrc()) {
      //console.log('Opening image dialog');
      setShowImageDialog(true);
    } else {
      //console.log('No image to show');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProfile();
      toast.success('Profile data refreshed');
    } catch (error) {
      toast.error('Failed to refresh profile');
    } finally {
      setRefreshing(false);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      // Validate profile image before saving
      if (profile) {
        const validation = validateImageDataUrl(profile);
        if (!validation.isValid) {
          throw new Error(`Invalid profile image: ${validation.error}`);
        }
      }

      // Save all profile fields at once using the new set_node_profile_tauri
      await invoke('set_node_profile_tauri', {
        name,
        college,
        regNo,
        profile,
        about
      });
      
      // Update original data to reflect saved state
      setOriginalData({ name, profile, about, college, regNo });
      setHasChanges(false);
      
      toast.success('Profile updated successfully!');
      
      // Refresh profile data after successful save to ensure consistency
      setTimeout(() => {
        loadProfile();
      }, 500);
    } catch (error) {
      //console.error('Failed to save profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Get avatar source - either base64 or fallback to initials
  const getAvatarSrc = () => {
    //console.log('getAvatarSrc called, profile:', profile ? `exists (length: ${profile.length})` : 'empty');
    if (profile && (profile.startsWith('data:image') || profile.startsWith('data:')) && profile.length > 20) {
      //console.log('Returning profile as avatar source');
      return profile;
    }
    //console.log('No valid profile, returning undefined');
    return undefined;
  };

  return (
    <div className="p-6 pb-20 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start space-y-1">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Profile Settings</h1>
        </div>
      </div>

      {/* Profile Picture Card */}
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
              <User className="h-5 w-5" />
              Profile Picture
            </CardTitle>
            <CardDescription>Upload your avatar (JPG, PNG or GIF)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group">
              <Avatar 
                className="h-32 w-32 cursor-pointer border-4 border-primary/20 hover:border-primary transition-all duration-300 shadow-lg hover:shadow-xl" 
                onClick={handleAvatarClick}
              >
                {getAvatarSrc() ? (
                  <AvatarImage 
                    src={getAvatarSrc()} 
                    alt={name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-bold">
                  {name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {getAvatarSrc() && (
                <div 
                  className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none"
                >
                  <p className="text-white text-xs font-medium">Click to view</p>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                aria-label="Upload profile picture"
              />
              <Button 
                variant="outline" 
                size="lg"
                className="gap-2 w-full sm:w-auto" 
                onClick={handleChangeAvatarClick}
              >
                <Upload className="h-4 w-4" />
                Upload New Avatar
            </Button>
            <p className="text-sm text-muted-foreground">
              {getAvatarSrc() 
                ? "Click avatar to view full size • Click button to change" 
                : "Upload your avatar (JPG, PNG or GIF)"}
            </p>
          </div>
        </CardContent>
      </div>
    </Card>

    {/* Personal Information Card */}
    <Card className="border-2 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <MeshGradient
          speed={0.5}
          colors={["#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8"]}
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
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="college" className="text-base font-medium">College</Label>
              <Select value={college} onValueChange={setCollege}>
                <SelectTrigger id="college" className="h-11">
                  <SelectValue placeholder="Select your college" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COICT">COICT (College of Information and Communication Technologies)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 hidden">
              <Label htmlFor="regNo" className="text-base font-medium">Registration Number</Label>
              <Input
                id="regNo"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="Enter your registration number"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="about" className="text-base font-medium">About</Label>
            <Textarea
              id="about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {about.length} characters
            </p>
          </div>

          {hasChanges && (
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button 
                onClick={saveProfile} 
                disabled={loading} 
                size="lg"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
            </div>
          )}
        </CardContent>
      </div>
    </Card>



    {/* Image Preview Dialog */}
    <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center justify-between text-xl">
            <span>Profile Picture</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowImageDialog(false)}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center pt-0 bg-muted/30">
          {getAvatarSrc() && (
            <img
              src={getAvatarSrc()}
              alt={name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>
);
};

export default ProfileSettings;