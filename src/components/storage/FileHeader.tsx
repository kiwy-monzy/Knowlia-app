import React, { useState, useEffect, useRef } from 'react';
import { useStorage } from '@/contexts/StorageContext';
import { ArrowLeft, Home, Folder, Grid, List, ChevronDown, RefreshCw } from 'lucide-react';

interface FileHeaderProps {
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  activeTab?: 'gdrive' | 'downloads';
  onTabChange?: (tab: 'gdrive' | 'downloads') => void;
}

const FileHeader: React.FC<FileHeaderProps> = ({ 
  viewMode = 'grid', 
  onViewModeChange, 
  activeTab = 'gdrive', 
  onTabChange 
}) => {
  const { currentPath, navigateUp, navigateToRoot, loadRootFolder, rootFolders, downloadsPath, downloadedFiles, setCurrentPath, setDownloadsPath, refreshRootFolders } = useStorage();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRootFolders();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Brief visual feedback
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const truncateName = (name: string, maxLength: number = 8): string => {
    if (!name) return '';
    
    // If name is short enough, return as-is
    if (name.length <= maxLength) {
      return name;
    }
    
    // Truncate to maxLength chars with '...'
    return name.slice(0, maxLength) + '...';
  };

  const handleHomeClick = () => {
    loadRootFolder();
    navigateToRoot();
  };

  const getBreadcrumbPath = () => {
    const path = activeTab === 'downloads' ? downloadsPath : currentPath;
    
    if (path.length === 0) {
      return [];
    }
    
    return path.map((folder, index) => ({
      name: folder.name,
      index: index,
      isLast: index === path.length - 1
    }));
  };

  const navigateToBreadcrumb = (targetIndex: number) => {
    // Navigate directly to the target folder
    const path = activeTab === 'downloads' ? downloadsPath : currentPath;
    
    if (activeTab === 'downloads') {
      // Navigate to specific folder in downloads
      const targetPath = path.slice(0, targetIndex + 1);
      setDownloadsPath(targetPath);
    } else {
      // Navigate to specific folder in Google Drive
      const targetPath = path.slice(0, targetIndex + 1);
      setCurrentPath(targetPath);
    }
  };

  const breadcrumbs = getBreadcrumbPath();

  return (
    <div className="border-b border-gray-200 bg-[#fafafa]">
      {/* Tabs */}
      <div className="flex items-center px-4 py-2 border-b border-gray-100">
        <button
          onClick={() => onTabChange && onTabChange('gdrive')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'gdrive'
              ? 'bg-white text-blue-600 border border-gray-200 border-b-0'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Google Drive
        </button>
        <button
          onClick={() => onTabChange && onTabChange('downloads')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ml-2 ${
            activeTab === 'downloads'
              ? 'bg-white text-blue-600 border border-gray-200 border-b-0'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Downloads
        </button>
      </div>
      
      {/* Navigation Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2">
          {/* Home button */}
          <button
            onClick={handleHomeClick}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="Go to root"
          >
            <Home className="w-4 h-4 text-gray-600" />
          </button>

          {/* Back button */}
          {(activeTab === 'downloads' ? downloadsPath.length > 0 : currentPath.length > 0) && (
            <button
              onClick={navigateUp}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {/* Breadcrumb navigation */}
          <div className="flex items-center space-x-1 text-sm flex-1 min-w-0">
            {breadcrumbs.length > 5 ? (
              // Show dropdown when too many breadcrumbs
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-1 p-2 rounded hover:bg-gray-100 transition-colors"
                  title={breadcrumbs[breadcrumbs.length - 1].name}
                >
                  <Folder className="w-4 h-4" />
                  <span className="truncate max-w-24">{truncateName(breadcrumbs[breadcrumbs.length - 1].name)}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-max">
                    <div className="py-1">
                      {breadcrumbs.map((breadcrumb, index) => (
                        <button
                          key={breadcrumb.index}
                          onClick={() => {
                            navigateToBreadcrumb(breadcrumb.index);
                            setShowDropdown(false);
                          }}
                          className={`flex items-center space-x-2 w-full px-3 py-2 text-left hover:bg-gray-50 ${
                            breadcrumb.isLast
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          <Folder className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{breadcrumb.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Show normal breadcrumbs when not too many
              <div className="flex items-center space-x-1 overflow-x-auto">
                {breadcrumbs.map((breadcrumb, index) => (
                  <React.Fragment key={breadcrumb.index}>
                    {index > 0 && (
                      <span className="text-gray-400 mx-1 flex-shrink-0">/</span>
                    )}
                    <button
                      onClick={() => navigateToBreadcrumb(breadcrumb.index)}
                      className={`flex items-center space-x-1 p-1 rounded transition-colors flex-shrink-0 max-w-32 ${
                        breadcrumb.isLast
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      title={breadcrumb.name}
                    >
                      <Folder className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{truncateName(breadcrumb.name, 12)}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Current folder info and view mode toggle */}
          <div className="flex items-center space-x-4">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className={`p-2 rounded transition-all duration-200 ${
                isRefreshing 
                  ? 'bg-blue-100 text-blue-600 animate-spin' 
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <div className="text-sm text-gray-500">
              {(() => {
                if (activeTab === 'downloads') {
                  if (downloadsPath.length === 0) return `${downloadedFiles.length} items`;
                  return `${downloadsPath[downloadsPath.length - 1].children?.length || 0} items`;
                } else {
                  if (currentPath.length === 0) return `${rootFolders.length} items`;
                  return `${currentPath[currentPath.length - 1].children?.length || 0} items`;
                }
              })()}
            </div>
            
            {/* View mode toggle */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onViewModeChange && onViewModeChange('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-gray-200 text-gray-700'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange && onViewModeChange('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-gray-200 text-gray-700'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileHeader;