import React from 'react';
import { Loader2, Eye } from 'lucide-react';
import './FileOpeningModal.css';

interface FileOpeningModalProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
}

const FileOpeningModal: React.FC<FileOpeningModalProps> = ({ 
  isOpen, 
  fileName, 
  onClose 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Animated opening icon */}
          <div className="relative">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
            <div className="absolute inset-0 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center file-opening-icon-ping opacity-20" />
          </div>
          
          {/* Loading spinner */}
          <div className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700 font-medium">Opening file...</span>
          </div>
          
          {/* File name */}
          <div className="text-center">
            <p className="text-sm text-gray-600 break-words line-clamp-2">
              {fileName}
            </p>
          </div>
          
          {/* Progress indicator */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-2 rounded-full file-opening-progress" 
                 style={{ width: '60%' }} />
          </div>
          
          {/* Status message */}
          <p className="text-xs text-gray-500 text-center">
            Please wait while we open your file
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileOpeningModal;
