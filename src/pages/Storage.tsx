import React, { useState } from "react";
import StorageSidebar from "@/components/storage/StorageSidebar";
import FileExplorer from "@/components/storage/FileExplorer";
import FileHeader from "@/components/storage/FileHeader";
import ProgressBar from "@/components/storage/ProgressBar";
import { StorageProvider } from "@/contexts/StorageContext";
import { useStorage } from "@/contexts/StorageContext";

const StorageContent: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { activeTab, setActiveTab, downloadTasks } = useStorage();

  return (
    <>
      <FileHeader 
        viewMode={viewMode} 
        onViewModeChange={setViewMode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="flex-1 overflow-auto">
        <FileExplorer viewMode={viewMode} />
      </div>
      
      <ProgressBar 
        downloads={downloadTasks} 
        isVisible={downloadTasks.length > 0} 
      />
    </>
  );
};

const StorageWithProvider: React.FC = () => {
  return (
    <div className="flex h-full overflow-hidden ">
      {/* Sidebar */}
      <StorageSidebar />
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col  overflow-hidden bg-[#fafafa]">
        <StorageContent />
      </div>
    </div>
  );
};

const Storage: React.FC = () => {
  return (
    <StorageProvider>
      <StorageWithProvider />
    </StorageProvider>
  );
};

export default Storage;
