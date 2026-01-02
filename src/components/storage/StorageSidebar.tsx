import { Server, Folder, File } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import SidebarHeader from "@/components/SidebarHeader";
import { useStorage } from "@/contexts/StorageContext";

const StorageSidebar = () => {
  const { rootFolders, loading, error, setCurrentPath } = useStorage();

  const handleFolderClick = (folder: any) => {
    // Reset to the selected folder as the root, don't append to current path
    setCurrentPath([folder]);
  };

  return (
    <div className="w-64 h-screen flex flex-col rounded-l-[2rem] rounded-bl-[2rem] border-r border-sidebar-border">
      {/* SidebarHeader */}
      <SidebarHeader
        title="Storage"
        Icon={Server}
        className="bg-sidebar border-sidebar-border"
        colorMode="default"
      />

      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-2 w-full">
          {/* PROGRAMMES Section */}
          <div className="mb-4">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center justify-between uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Folder className="h-3 w-3" />
                PROGRAMMES
              </span>
            </div>
            
            {!loading && !error && rootFolders.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                No folders found
              </div>
            )}
            
            <div className="space-y-0.5 mt-1">
              {rootFolders.map((folder) => (
                <div
                  key={folder.data_id || folder.name}
                  onClick={() => handleFolderClick(folder)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                >
                  <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm truncate flex-1 min-w-0 max-w-[160px]" title={folder.name}>{folder.name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};

export default StorageSidebar;

