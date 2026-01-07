import React, { useState, useEffect } from 'react';
import { useStorage } from '@/contexts/StorageContext';
import { Download, Eye } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import NoContent from '../NoContent';
import FileOpeningModal from './FileOpeningModal';
import { DocumentPreview } from '../DocumentPreview';

interface FileExplorerProps {
  viewMode?: 'grid' | 'list';
}

const FileExplorer: React.FC<FileExplorerProps> = ({ viewMode = 'grid' }) => {
  const { getCurrentItems, loading, error, navigateToFolder, currentPath, activeTab, recordedDownloads } = useStorage();
  const [recentlyDownloaded, setRecentlyDownloaded] = useState<Set<string>>(new Set());
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [openingFileName, setOpeningFileName] = useState('');
  const [documentPreview, setDocumentPreview] = useState<{ content: string; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const items = getCurrentItems();

  // Listen for download completion to mark files as recently downloaded
  useEffect(() => {
    const setupDownloadListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      
      await listen('download-progress', (event) => {
        const progress = event.payload as any;
        if (progress.status === 'completed') {
          // Mark file as recently downloaded
          setRecentlyDownloaded(prev => new Set([...prev, progress.file_name]));
          
          // Remove from recently downloaded after 5 seconds
          setTimeout(() => {
            setRecentlyDownloaded(prev => {
              const newSet = new Set(prev);
              newSet.delete(progress.file_name);
              return newSet;
            });
          }, 5000);
        }
      });
    };

    setupDownloadListener();
  }, []);

  const getFileIcon = (fileType?: string, isFolder?: boolean): string => {
    if (isFolder) return '/storage-icons/folder.png';
    
    const type = fileType?.toLowerCase();
    switch (type) {
      case 'pdf':
        return '/storage-icons/pdf.png';
      case 'docx':
      case 'doc':
        return '/storage-icons/docx.png';
      case 'xlsx':
      case 'xls':
        return '/storage-icons/xlsx.png';
      case 'pptx':
      case 'ppt':
        return '/storage-icons/pptx.png';
      case 'txt':
        return '/storage-icons/txt.png';
      case 'jpg':
      case 'jpeg':
        return '/storage-icons/jpg.png';
      case 'png':
        return '/storage-icons/png.png';
      default:
        return '/storage-icons/none.png';
    }
  };

  const isFileDownloaded = (fileId: string | undefined, fileName: string): boolean => {
    if (!fileId) return false; // Skip if no file ID
    
    // Check if file exists in recorded downloads
    const isRecorded = recordedDownloads.some(download => 
      download.file_id === fileId || download.file_name === fileName
    );
    
    // Also check if we're in downloads tab
    const isInDownloads = activeTab === 'downloads';
    
    return isRecorded || isInDownloads;
  };

  const handleFileClick = async (file: any) => {
    if (!file.data_id) {
      console.warn('Cannot download file: no file ID available');
      return;
    }
    
    try {
      await invoke('download_drive_file', {
        fileId: file.data_id,
        fileName: file.name
      });
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const handleOpenFile = async (file: any) => {
    try {
      // Show opening modal
      setIsOpeningFile(true);
      setOpeningFileName(file.name);
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt'];
      
      if (supportedFormats.includes(fileExtension || '')) {
        // Open file with DocumentPreview component
        try {
          // Get file content as base64 from Tauri
          // Use the correct path for KNOWLIA#NOTES directory
          const fileContent = await invoke('read_file_as_base64', {
            filePath: `C:\\Users\\PC\\Documents\\KNOWLIA#NOTES\\${file.name}`
          });
          
          // Set document preview state
          setDocumentPreview({
            content: fileContent as string,
            name: file.name
          });
        } catch (previewError) {
          console.error('Failed to load file for preview:', previewError);
          // Fallback to regular file opening
          await invoke('open_storage_file', { file_name: file.name });
        }
      } else {
        // For unsupported formats, open with default system application
        await invoke('open_storage_file', {
          file_name: file.name
        });
      }
      
      // Hide modal after a short delay
      setTimeout(() => {
        setIsOpeningFile(false);
        setOpeningFileName('');
      }, 1500);
      
    } catch (err) {
      console.error('Failed to open file:', err);
      // Hide modal on error
      setIsOpeningFile(false);
      setOpeningFileName('');
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <NoContent title="Loading..." />
      </div>
    );
  }



  // Remove the check for currentPath.length === 0 to show root folders by default
  // if (currentPath.length === 0) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <div className="text-gray-500">Select a folder from the sidebar to view contents</div>
  //     </div>
  //   );
  // }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <NoContent title="This folder is empty" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full h-full p-4 bg-[#fafafa] transition-opacity duration-200 ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.data_id || item.name}
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              onClick={() => item.is_folder && navigateToFolder(item)}
              title={item.name}
            >
              {/* Icon */}
              <div className="relative mb-2">
                <img 
                  src={getFileIcon(item.file_type, item.is_folder)} 
                  alt={item.is_folder ? 'Folder' : 'File'}
                  className="w-16 h-16 object-contain"
                />
                
                {/* Downloaded indicator */}
                {(recentlyDownloaded.has(item.name) || isFileDownloaded(item.data_id, item.name)) && (
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="Downloaded" />
                )}
                
                {!item.is_folder && (
                  <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.data_id && isFileDownloaded(item.data_id, item.name) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFile(item);
                        }}
                        className="p-1.5 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-md transition-colors"
                        title="Open file"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    ) : item.data_id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileClick(item);
                        }}
                        className="p-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-colors"
                        title="Download file"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              
              {/* Filename */}
              <div className="text-center w-full">
                <div className="text-xs text-gray-700 leading-tight break-words line-clamp-2">
                  {item.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.data_id || item.name}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer transition-all duration-200"
              onClick={() => item.is_folder && navigateToFolder(item)}
              title={item.name}
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {/* Downloaded indicator */}
                {(recentlyDownloaded.has(item.name) || isFileDownloaded(item.data_id, item.name)) && (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0" title="Downloaded" />
                )}
                
                <img 
                  src={getFileIcon(item.file_type, item.is_folder)} 
                  alt={item.is_folder ? 'Folder' : 'File'}
                  className="w-8 h-8 object-contain flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                  <div className="text-sm text-gray-500">
                    {item.is_folder ? 'Folder' : item.file_type || 'File'}
                    {item.size && ` • ${item.size}`}
                  </div>
                </div>
              </div>
              
              {!item.is_folder && (
                <div className="flex items-center flex-shrink-0">
                  {item.data_id && isFileDownloaded(item.data_id, item.name) ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFile(item);
                      }}
                      className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-md transition-colors"
                      title="Open file"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : item.data_id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileClick(item);
                      }}
                      className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* File Opening Modal */}
      <FileOpeningModal 
        isOpen={isOpeningFile}
        fileName={openingFileName}
        onClose={() => {
          setIsOpeningFile(false);
          setOpeningFileName('');
        }}
      />
      
      {/* Document Preview Modal */}
      {documentPreview && (
        <DocumentPreview
          fileContent={documentPreview.content}
          fileName={documentPreview.name}
          onClose={() => setDocumentPreview(null)}
        />
      )}
    </div>
  );
};

export default FileExplorer;
