import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from './SimpleCard';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Tag, 
  Image, 
  RefreshCw, 
  Square, 
  Binoculars,
  X 
} from 'lucide-react';

interface AppData {
  pid: number;
  process_name: string;
  total_focus_time: number;
  updated_at: string;
}

interface WindowInfoData {
  title: string;
  created_at: string;
  llm_category: string;
  llm_keywords: string;
  llm_description: string;
  screenshot_url?: string;
}

const WindowInfoPanel: React.FC = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null);
  const [windowInfo, setWindowInfo] = useState<WindowInfoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedWindows, setExpandedWindows] = useState<Set<number>>(new Set());
  const [windowLimit, setWindowLimit] = useState(10);
  const [showAllApps, setShowAllApps] = useState(false);

  // Modal state for screenshot zoom
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState("");

  // Time filtering
  const [timeRangeValue, setTimeRangeValue] = useState("Last Hour");
  const [timeRange, setTimeRange] = useState(1);

  const timeRangeOptions = [
    { value: 1, label: "Last Hour" },
    { value: 6, label: "Last 6 Hours" },
    { value: 12, label: "Last 12 Hours" },
    { value: 24, label: "Last 24 Hours" },
  ];

  const loadApps = async () => {
    try {
      setLoading(true);
      setError("");
      const appsData = await invoke<AppData[]>("get_apps_by_time_range", {
        hours: timeRange,
      });

      appsData.sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
      );
      
      const filteredApps = appsData.filter(
        (app1, i, arr) =>
          arr.findIndex((app2) => app1.process_name === app2.process_name) === i &&
          Date.parse(app1.updated_at) > Date.now() - timeRange * 60 * 60 * 1000,
      );
      
      setApps(filteredApps);
    } catch (err) {
      console.error("Failed to load apps:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadWindowInfo = async (app: AppData) => {
    try {
      setLoading(true);
      setError("");
      setSelectedApp(app);
      const windowData = await invoke<WindowInfoData[]>(
        "get_window_info_by_pid_and_time",
        {
          pid: app.pid,
          limit: windowLimit,
          hours: timeRange,
        },
      );
      setWindowInfo(windowData);
    } catch (err) {
      console.error("Failed to load window info:", err);
      setError(err instanceof Error ? err.message : String(err));
      setWindowInfo([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshApps = async () => {
    await loadApps();
    if (selectedApp) {
      await loadWindowInfo(selectedApp);
    }
  };

  useEffect(() => {
    if (timeRangeValue) {
      const range = timeRangeOptions.find(
        (option) => option.label === timeRangeValue,
      )?.value ?? 24;
      setTimeRange(range);
      refreshApps();
    }
  }, [timeRangeValue]);

  const loadMoreWindows = () => {
    setWindowLimit(windowLimit + 10);
    if (selectedApp) {
      loadWindowInfo(selectedApp);
    }
  };

  const toggleWindowExpanded = (index: number) => {
    const newExpanded = new Set(expandedWindows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedWindows(newExpanded);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const openImageModal = (imageSrc: string) => {
    setModalImageSrc(imageSrc);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setModalImageSrc("");
  };

  const handleImageKeydown = (event: React.KeyboardEvent, imageSrc: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openImageModal(imageSrc);
    }
  };

  const handleModalKeydown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      closeImageModal();
    }
  };

  useEffect(() => {
    loadApps();
  }, []);


  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            Window Activity Tracker
          </h2>
          <p className="text-muted-foreground">
            Monitor application usage and window activity across your system.
          </p>
        </div>
        
        {/* Controls Section */}
        <div className="flex items-center gap-2">
          <label htmlFor="timeRange" className="text-sm font-bold">Time Range:</label>
          <select 
            id="timeRange"
            value={timeRangeValue} 
            onChange={(e) => setTimeRangeValue(e.target.value)}
            className="w-[180px] px-3 py-2 border rounded-md"
            aria-label="Select time range for window activity"
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* App Selection */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 max-w-full lg:max-w-1/3 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex flex-row justify-around">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Square className="w-5 h-5" />
              Applications
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-28"
              onClick={() => setShowAllApps(!showAllApps)}
            >
              {showAllApps ? "Show Top 10" : "Show All"}
            </Button>
          </div>

          {loading && apps.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : apps.length === 0 ? (
            <p className="text-muted-foreground">
              No applications found in the database.
            </p>
          ) : (
            <>
              {/* Status Indicator */}
              <div className="bg-white border rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between text-sm gap-x-4">
                  <span className="text-muted-foreground">
                    Showing {showAllApps ? apps.length : Math.min(apps.length, 10)} of {apps.length} applications
                  </span>
                  <span className="text-muted-foreground">
                    Time range: {timeRangeOptions.find((opt) => opt.value === timeRange)?.label || "Custom"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 max-h-80 lg:max-h-full overflow-y-auto">
                {(showAllApps ? apps : apps.slice(0, 10)).map((app) => (
                  <button
                    key={app.pid}
                    className="text-left relative border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => loadWindowInfo(app)}
                  >
                    <div className="flex items-center justify-between group">
                      <div className="flex-1">
                        <h4 className="font-medium">{app.process_name}</h4>
                        <div className="text-sm text-muted-foreground mt-1">
                          <span>PID: {app.pid}</span>
                          {app.total_focus_time && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Total: {formatDuration(app.total_focus_time)}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last updated: {formatDate(app.updated_at)}
                        </div>
                      </div>
                      <Binoculars className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Window Information */}
        <div className="max-w-full lg:w-2/3 bg-white border border-gray-200 rounded-lg p-6">
          {selectedApp ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Image className="w-5 h-5" />
                    Windows for {selectedApp.process_name} (PID: {selectedApp.pid})
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Showing activity from {timeRangeOptions.find((opt) => opt.value === timeRange)?.label?.toLowerCase() || "selected time range"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedApp && loadWindowInfo(selectedApp)}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>

              {loading && windowInfo.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : windowInfo.length === 0 ? (
                <p className="text-muted-foreground">
                  No window information found for this application.
                </p>
              ) : (
                <>
                  {/* Window Stats */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {windowInfo.length} window{windowInfo.length !== 1 ? "s" : ""} found
                        </span>
                        {windowInfo.length > 0 && (
                          <>
                            <span className="text-muted-foreground">
                              Latest: {formatDate(windowInfo[0].created_at)}
                            </span>
                            {windowInfo.length > 1 && (
                              <span className="text-muted-foreground">
                                Oldest: {formatDate(windowInfo[windowInfo.length - 1].created_at)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {windowInfo.length >= windowLimit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadMoreWindows}
                          disabled={loading}
                        >
                          Load More
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {windowInfo.map((window, index) => (
                      <div key={window.created_at} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                          onClick={() => toggleWindowExpanded(index)}
                        >
                          <div className="flex-1">
                            <div className="font-medium">{window.title}</div>
                            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(window.created_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {window.llm_category}
                              </span>
                            </div>
                          </div>
                          {expandedWindows.has(index) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>

                        {expandedWindows.has(index) && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            <div className="grid md:grid-cols-2 gap-6 mt-4">
                              {/* Screenshot */}
                              <div className="relative">
                                <h4 className="font-medium my-2">Screenshot</h4>
                                {window.screenshot_url ? (
                                  <div
                                    className="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Click to zoom screenshot"
                                    onClick={() => openImageModal(window.screenshot_url!)}
                                    onKeyDown={(e) => handleImageKeydown(e, window.screenshot_url!)}
                                  >
                                    <img
                                      src={window.screenshot_url}
                                      alt={`Window screenshot for ${window.title}`}
                                      className="w-full h-auto max-h-64 object-contain bg-gray-50 hover:opacity-90 transition-opacity"
                                      loading="lazy"
                                    />
                                  </div>
                                ) : (
                                  <div className="border border-gray-200 rounded-lg p-8 text-center text-muted-foreground bg-gray-50">
                                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No screenshot available
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium mt-12 mb-2">Keywords</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {window.llm_keywords ? (
                                      window.llm_keywords
                                        .split(",")
                                        .filter((k) => k.trim())
                                        .map((keyword, idx) => (
                                          <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                            {keyword.trim()}
                                          </span>
                                        ))
                                    ) : (
                                      <span className="text-sm text-muted-foreground">No keywords</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <h4 className="font-medium my-2">Description</h4>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border">
                              {window.llm_description || "No description available"}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Card.Root className="p-8 text-center border-none shadow-none">
              <div className="flex flex-row font-medium mx-auto text-muted-foreground">
                <Square className="w-24 h-24" />
                <span className="ml-2 text-8xl">?</span>
              </div>
              <h4 className="text-lg font-semibold mb-2">No Application Selected</h4>
              <p className="text-muted-foreground">
                Select an application to view its information.
              </p>
            </Card.Root>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-primary/50 bg-opacity-75 flex items-center justify-center z-50"
          role="dialog"
          aria-label="Screenshot zoom modal"
          tabIndex={-1}
          onClick={closeImageModal}
          onKeyDown={handleModalKeydown}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] p-4">
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={closeImageModal}
            >
              <X />
            </Button>
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <img
                src={modalImageSrc}
                alt="Screenshot (zoomed)"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WindowInfoPanel;
