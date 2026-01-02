import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface GDriveItem {
  name: string;
  data_id?: string;
  is_folder: boolean;
  size?: string;
  file_type?: string;
  url?: string;
  parent_id?: string;
  children?: GDriveItem[];
}

interface DownloadRecord {
  file_id: string;
  file_name: string;
  download_time: string;
  file_path: string;
}

interface DownloadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  startTime: Date;
  error?: string;
}

interface StorageContextType {
  rootFolders: GDriveItem[];
  currentPath: GDriveItem[];
  downloadsPath: GDriveItem[];
  downloadedFiles: GDriveItem[];
  recordedDownloads: DownloadRecord[];
  loading: boolean;
  error: string | null;
  activeTab: 'gdrive' | 'downloads';
  setActiveTab: (tab: 'gdrive' | 'downloads') => void;
  setCurrentPath: (path: GDriveItem[]) => void;
  setDownloadsPath: (path: GDriveItem[]) => void;
  downloadTasks: DownloadTask[];
  setDownloadTasks: (tasks: DownloadTask[]) => void;
  navigateToFolder: (folder: GDriveItem) => void;
  navigateUp: () => void;
  navigateToRoot: () => void;
  loadRootFolder: () => Promise<void>;
  refreshRootFolders: () => Promise<void>;
  getCurrentItems: () => GDriveItem[];
  loadDownloadedFiles: () => Promise<void>;
  loadRecordedDownloads: () => Promise<DownloadRecord[]>;
  checkFileDownloaded: (fileId: string) => Promise<boolean>;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
};

interface StorageProviderProps {
  children: React.ReactNode;
}

export const StorageProvider: React.FC<StorageProviderProps> = ({ children }) => {
  const [rootFolders, setRootFolders] = useState<GDriveItem[]>([]);
  const [currentPath, setCurrentPath] = useState<GDriveItem[]>([]);
  const [downloadsPath, setDownloadsPath] = useState<GDriveItem[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<GDriveItem[]>([]);
  const [recordedDownloads, setRecordedDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gdrive' | 'downloads'>('gdrive');
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);

const loadRootFolder = useCallback(async () => {
  try {
    setLoading(true);
    // Change from 'get_gdrive_root_folders' to 'get_root_folders'
    const folders = await invoke<GDriveItem[]>('get_root_folders');
    setRootFolders(folders);
    setError(null);
  } catch (err) {
    console.error('Error loading root folders:', err);
    setError('Failed to load folders');
  } finally {
    setLoading(false);
  }
}, []);

  const loadDownloadedFiles = useCallback(async () => {
    try {
      setLoading(true);
      const files = await invoke<GDriveItem[]>('scan_downloads_with_metadata');
      setDownloadedFiles(files);
      setDownloadsPath([]);
    } catch (err) {
      console.error('Failed to load downloaded files:', err);
      setError('Failed to load downloaded files');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecordedDownloads = useCallback(async () => {
    try {
      console.log('Loading recorded downloads...');
      const downloads = await invoke<DownloadRecord[]>('get_recorded_downloads_command');
      console.log('Loaded recorded downloads:', downloads);
      setRecordedDownloads(downloads);
      return downloads;
    } catch (err) {
      console.error('Failed to load recorded downloads:', err);
      setRecordedDownloads([]);
      return [];
    }
  }, []);

  const checkFileDownloaded = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      return await invoke<boolean>('check_file_downloaded', { fileId });
    } catch (err) {
      console.error('Error checking if file is downloaded:', err);
      return false;
    }
  }, []);

  const navigateToFolder = useCallback((folder: GDriveItem) => {
    if (folder.is_folder) {
      setCurrentPath(prev => [...prev, folder]);
    }
  }, []);

  const navigateUp = useCallback(() => {
    if (activeTab === 'downloads') {
      if (downloadsPath.length > 0) {
        setDownloadsPath(prev => prev.slice(0, -1));
      }
    } else if (currentPath.length > 0) {
      setCurrentPath(prev => prev.slice(0, -1));
    }
  }, [activeTab, downloadsPath.length, currentPath.length]);

  const navigateToRoot = useCallback(() => {
    if (activeTab === 'downloads') {
      setDownloadsPath([]);
    } else {
      setCurrentPath([]);
    }
  }, [activeTab]);

  const refreshRootFolders = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'downloads') {
        await loadDownloadedFiles();
      } else {
        await loadRootFolder();
      }
    } catch (err) {
      console.error('Error refreshing folders:', err);
      setError('Failed to refresh folders');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadDownloadedFiles, loadRootFolder]);

  const getCurrentItems = useCallback((): GDriveItem[] => {
    if (activeTab === 'downloads') {
      if (downloadsPath.length === 0) return downloadedFiles;
      const lastFolder = downloadsPath[downloadsPath.length - 1];
      return lastFolder.children || [];
    } else {
      if (currentPath.length === 0) return rootFolders;
      const lastFolder = currentPath[currentPath.length - 1];
      return lastFolder.children || [];
    }
  }, [activeTab, currentPath, downloadsPath, downloadedFiles, rootFolders]);

  useEffect(() => {
    const setupDownloadListener = async () => {
      await listen('download-progress', (event) => {
        const progress = event.payload as {
          status: string;
          file_id?: string;
          fileName?: string;
          file_name?: string;
          percentage: number;
        };
        
        const fileId = progress.file_id || progress.fileName || 'unknown';
        
        if (progress.status === 'downloading') {
          setDownloadTasks(prev => {
            const existingTask = prev.find(task => task.id === fileId);
            if (existingTask) {
              return prev.map(task => 
                task.id === fileId 
                  ? { ...task, progress: progress.percentage, status: 'downloading' as const }
                  : task
              );
            } else {
              return [...prev, {
                id: fileId,
                fileName: progress.file_name || 'Unknown file',
                progress: progress.percentage,
                status: 'downloading' as const,
                startTime: new Date()
              }];
            }
          });
        } else if (progress.status === 'completed') {
          setDownloadTasks(prev => 
            prev.map(task => 
              task.id === fileId 
                ? { ...task, progress: 100, status: 'completed' as const }
                : task
            )
          );
          setTimeout(() => {
            setDownloadTasks(prev => prev.filter(task => task.id !== fileId));
          }, 3000);
          loadDownloadedFiles();
          loadRecordedDownloads();
        } else if (typeof progress.status === 'string' && progress.status.includes('error')) {
          setDownloadTasks(prev => 
            prev.map(task => 
              task.id === fileId 
                ? { ...task, progress: 0, status: 'error' as const }
                : task
            )
          );
        }
      });
    };

    setupDownloadListener().catch(console.error);
  }, [loadDownloadedFiles, loadRecordedDownloads]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadRootFolder(),
          loadDownloadedFiles(),
          loadRecordedDownloads()
        ]);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    init();

    // Set up a refresh interval to keep downloads list updated
    const intervalId = setInterval(() => {
      if (activeTab === 'downloads') {
        loadDownloadedFiles();
        loadRecordedDownloads();
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(intervalId);
  }, [loadRootFolder, loadDownloadedFiles, loadRecordedDownloads, activeTab]);

  const value: StorageContextType = {
    rootFolders,
    currentPath,
    downloadsPath,
    downloadedFiles,
    recordedDownloads,
    loading,
    error,
    activeTab,
    setActiveTab,
    setCurrentPath,
    setDownloadsPath,
    downloadTasks,
    setDownloadTasks,
    navigateToFolder,
    navigateUp,
    navigateToRoot,
    loadRootFolder,
    refreshRootFolders,
    getCurrentItems,
    loadDownloadedFiles,
    loadRecordedDownloads,
    checkFileDownloaded,
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
};