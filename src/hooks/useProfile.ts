import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ProfileData {
  name: string;
  profile: string;
  about: string;
  college: string;
}

export const useProfile = () => {
  const [profileData, setProfileData] = useState<ProfileData>({
    name: 'User',
    profile: '',
    about: '',
    college: ''
  });
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const loadProfile = async () => {
    try {
      const profileResult = await invoke<string>('user_profile');
      
      if (profileResult) {
        let profile;
        try {
          profile = JSON.parse(profileResult);
        } catch (parseError) {
          profile = { name: 'User', profile: '', about: '', college: '' };
        }
        
        setProfileData({
          name: profile.name || 'User',
          profile: profile.profile || '',
          about: profile.about || '',
          college: profile.college || ''
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfileData({
        name: 'User',
        profile: '',
        about: '',
        college: ''
      });
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await invoke<number>('get_total_unread_count');
      setTotalUnreadCount(count);
    } catch (error) {
      setTotalUnreadCount(0);
    }
  };

  useEffect(() => {
    loadProfile();
    loadUnreadCount();
    
    const intervalId = setInterval(() => {
      loadProfile();
      loadUnreadCount();
    }, 500);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    loadUnreadCount();
    
    const unreadInterval = setInterval(() => {
      loadUnreadCount();
    }, 300);
    
    return () => clearInterval(unreadInterval);
  }, []);

  return {
    profileData,
    totalUnreadCount,
    loadProfile,
    loadUnreadCount
  };
};
