import React, { useEffect, useRef } from 'react';

interface DocumentPreviewProps {
  fileContent: string;
  fileName: string;
  onClose: () => void;
}

declare global {
  interface Window {
    PSPDFKit: any;
    NutrientViewer: any;
  }
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  fileContent, 
  fileName, 
  onClose 
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!viewerRef.current || !fileContent) return;

    const createViewer = async () => {
      if (!viewerRef.current) return;
      
      try {
        // Use PSPDFKit Nutrient viewer that's already loaded in index.html
        if (window.PSPDFKit) {
          const instance = await window.PSPDFKit.load({
            container: viewerRef.current,
            document: `data:application/octet-stream;base64,${fileContent}`,
            baseUrl: 'https://cdn.cloud.pspdfkit.com/pspdfkit-web@1.10.0/'
          });
          viewerInstanceRef.current = instance;
        } else if (window.NutrientViewer) {
          // Fallback to NutrientViewer if available
          const viewer = new window.NutrientViewer({
            container: viewerRef.current,
            document: `data:application/octet-stream;base64,${fileContent}`
          });
          viewerInstanceRef.current = viewer;
        }
      } catch (error) {
        console.error('Error creating viewer:', error);
      }
    };

    const initializeViewer = async () => {
      try {
        // Wait a bit for the PSPDFKit script to be available
        const checkViewer = () => {
          if (window.PSPDFKit || window.NutrientViewer) {
            createViewer();
          } else {
            setTimeout(checkViewer, 100);
          }
        };
        checkViewer();
      } catch (error) {
        console.error('Failed to initialize viewer:', error);
      }
    };

    // Add a small delay to ensure the container is ready
    const timeoutId = setTimeout(initializeViewer, 100);

    return () => {
      clearTimeout(timeoutId);
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy();
        } catch (e) {
          console.log('Error destroying viewer:', e);
        }
        viewerInstanceRef.current = null;
      }
    };
  }, [fileContent]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{fileName}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Close preview"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Viewer Container */}
        <div className="flex-1 overflow-hidden">
          <div 
            ref={viewerRef} 
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
        </div>
      </div>
    </div>
  );
};
