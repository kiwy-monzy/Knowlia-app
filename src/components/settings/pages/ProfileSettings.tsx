import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, X, Upload, User, RefreshCw, UserCircle, Edit3, Camera, Image } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { processProfileImage, validateImageDataUrl } from '@/utils/imageUtils';
import { exit, relaunch } from '@tauri-apps/plugin-process';

const ProfileSettings = () => {
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(''); // Base64 encoded image
  const [about, setAbout] = useState('');
  const [college, setCollege] = useState('');
  const [regNoParts, setRegNoParts] = useState({
    year: '',
    batch: '',
    number: ''
  });
  const [regNo, setRegNo] = useState(''); // Full registration number
  const [udsmImageUrl, setUdsmImageUrl] = useState(''); // UDSM student photo URL
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showUdsmImageDialog, setShowUdsmImageDialog] = useState(false);
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

  // Update UDSM image URL when registration number changes
  useEffect(() => {
    if (regNo && regNo.trim()) {
      const udsmUrl = `https://aris3.udsm.ac.tz/uploaded_files/student/photos/${regNo.trim()}.jpg`;
      setUdsmImageUrl(udsmUrl);
    } else {
      setUdsmImageUrl('');
    }
  }, [regNo]);

  // Update regNo when regNoParts change
  useEffect(() => {
    const fullRegNo = `${regNoParts.year}-${regNoParts.batch}-${regNoParts.number}`.replace(/--/g, '-').replace(/^-|-$/g, '');
    setRegNo(fullRegNo);
  }, [regNoParts]);

  // Parse registration number into parts when loaded
  const parseRegNo = (fullRegNo: string) => {
    const parts = fullRegNo.split('-');
    return {
      year: parts[0] || '',
      batch: parts[1] || '',
      number: parts[2] || ''
    };
  };

  const handleRegNoPartChange = (part: keyof typeof regNoParts, value: string) => {
    let newValue = value;
    
    // Auto-format based on part
    if (part === 'year') {
      newValue = value.replace(/\D/g, '').slice(0, 4);
    } else if (part === 'batch') {
      newValue = value.replace(/\D/g, '').slice(0, 2);
    } else if (part === 'number') {
      newValue = value.replace(/\D/g, '').slice(0, 5);
    }
    
    setRegNoParts(prev => ({
      ...prev,
      [part]: newValue
    }));
  };

  const loadProfile = async () => {
    try {
      const profileJson = await invoke<string>('user_profile');
      const profileData = JSON.parse(profileJson);
      
      const loadedData = {
        name: profileData.name || '',
        profile: profileData.profile || '',
        about: profileData.about || '',
        college: profileData.college || '',
        regNo: profileData.reg_no || ''
      };

      setName(loadedData.name);
      setProfile(loadedData.profile);
      setAbout(loadedData.about);
      setCollege(loadedData.college);
      setRegNo(loadedData.regNo);
      setRegNoParts(parseRegNo(loadedData.regNo));
      setOriginalData(loadedData);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      toast.error(`File too large: ${Math.round(file.size / 1024)}KB (max: ${maxSize / 1024}KB)`);
      return;
    }

    try {
      const processedImage = await processProfileImage(file);
      setProfile(processedImage);
      toast.success('Image uploaded successfully');
      
      // Clear the file input
      if (event.target) {
        event.target.value = '';
      }
    } catch (error) {
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
    e.stopPropagation();
    if (getAvatarSrc()) {
      setShowImageDialog(true);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProfile();
      // Also refresh UDSM image by forcing URL update
      if (regNo && regNo.trim()) {
        const timestamp = Date.now();
        const udsmUrl = `https://aris3.udsm.ac.tz/uploaded_files/student/photos/${regNo.trim()}.jpg?t=${timestamp}`;
        setUdsmImageUrl(udsmUrl);
      }
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

      // Save all profile fields at once
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
      
      // Refresh profile data after successful save
      setTimeout(() => {
        loadProfile();
        relaunch();
      }, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Get avatar source - either base64 or fallback to initials
  const getAvatarSrc = () => {
    if (profile && (profile.startsWith('data:image') || profile.startsWith('data:')) && profile.length > 20) {
      return profile;
    }
    return undefined;
  };

  const handleUdsmImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (udsmImageUrl) {
      setShowUdsmImageDialog(true);
    }
  };

  const handleRefreshUdsmImage = () => {
    if (regNo && regNo.trim()) {
      const timestamp = Date.now();
      const udsmUrl = `https://aris3.udsm.ac.tz/uploaded_files/student/photos/${regNo.trim()}.jpg?t=${timestamp}`;
      setUdsmImageUrl(udsmUrl);
      toast.success('UDSM image refreshed');
    }
  };

  return (
    <div className="p-6 pb-18 space-y-6 bg-white min-h-screen">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Profile Settings</h2>
          <p className="text-gray-600 mt-1">Manage your account information and preferences</p>
        </div>
        <div className="flex items-center space-x-3">
          {hasChanges && (
            <div className="flex items-center space-x-2 mr-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium text-blue-700">Refresh</span>
          </button>
          {hasChanges && (
            <button
              onClick={saveProfile}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Picture Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <UserCircle className="w-5 h-5 text-blue-600" />
            <span>Profile Picture</span>
          </h3>
          <button
            onClick={handleChangeAvatarClick}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="text-sm font-medium">Change Photo</span>
          </button>
        </div>

        <div className="flex items-center space-x-6">
          <div 
            className="relative cursor-pointer group"
            onClick={handleAvatarClick}
          >
            <Avatar className="w-24 h-24 border-4 border-gray-200">
              <AvatarImage src={getAvatarSrc()} alt="Profile" />
              <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {name ? name.charAt(0).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">
              Click your profile picture to view or change it. Supported formats: JPG, PNG, GIF. Max size: 15MB.
            </p>
            <input
              aria-label="Upload profile picture"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Basic Information Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Basic Information</span>
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="about" className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <Textarea
              id="about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {about.length} characters
            </p>
          </div>
        </div>
      </div>

      {/* Academic Information Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            <span>Academic Information</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1">
              College/University
            </label>
            <Input
              id="college"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="Enter your institution"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="regNo" className="block text-sm font-medium text-gray-700 mb-1">
              Registration Number
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Input
                  value={regNoParts.year}
                  onChange={(e) => handleRegNoPartChange('year', e.target.value)}
                  placeholder="2024"
                  maxLength={4}
                  className="w-20 text-center"
                />
                <span className="text-gray-500 font-medium">-</span>
                <Input
                  value={regNoParts.batch}
                  onChange={(e) => handleRegNoPartChange('batch', e.target.value)}
                  placeholder="04"
                  maxLength={2}
                  className="w-16 text-center"
                />
                <span className="text-gray-500 font-medium">-</span>
                <Input
                  value={regNoParts.number}
                  onChange={(e) => handleRegNoPartChange('number', e.target.value)}
                  placeholder="06629"
                  maxLength={5}
                  className="w-24 text-center"
                />
              </div>
              {udsmImageUrl && (
                <div className="relative group">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={handleUdsmImageClick}
                  >
                    <img
                      src={udsmImageUrl}
                      alt="UDSM Student Photo"
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 object-cover hover:border-blue-400 transition-colors"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Image className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshUdsmImage();
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
                    title="Refresh UDSM image"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Click to view UDSM photo
                  </div>
                </div>
              )}
            </div>
            {regNoParts.year && regNoParts.batch && regNoParts.number && (
              <p className="text-xs text-gray-500 mt-1">
                UDSM Photo: {udsmImageUrl ? 'Available' : 'Not found'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center justify-between text-xl">
              <span>Profile Picture</span>
              <button
                onClick={() => setShowImageDialog(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            <div className="flex justify-center">
              <img 
                src={getAvatarSrc()} 
                alt="Profile" 
                className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UDSM Image Preview Dialog */}
      <Dialog open={showUdsmImageDialog} onOpenChange={setShowUdsmImageDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center justify-between text-xl">
              <span>UDSM Student Photo</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefreshUdsmImage}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh image"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowUdsmImageDialog(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            <div className="flex justify-center">
              <img 
                src={udsmImageUrl} 
                alt="UDSM Student Photo" 
                className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                onError={(e) => {
                  toast.error('Failed to load UDSM image');
                }}
              />
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Registration Number: <span className="font-medium">{regNo}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Source: ARIS3 UDSM Student Portal
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileSettings;