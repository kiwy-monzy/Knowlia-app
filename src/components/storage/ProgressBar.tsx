import React from 'react';

interface DownloadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  startTime: Date;
}

interface ProgressBarProps {
  downloads: DownloadTask[];
  isVisible: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ downloads, isVisible }) => {
  if (!isVisible || downloads.length === 0) return null;

  const activeDownloads = downloads.filter(d => d.status === 'downloading');
  
  if (activeDownloads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-50 w-80 max-h-64 overflow-y-auto">
      <div className="text-sm font-medium text-gray-700 mb-2">
        Downloads ({activeDownloads.length})
      </div>
      <div className="space-y-2">
        {activeDownloads.map((download) => (
          <div key={download.id} className="border border-gray-100 rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700 truncate flex-1 mr-2">
                {download.fileName}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(download.progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${download.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
