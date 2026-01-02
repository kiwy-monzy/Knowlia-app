import React, { useState, useEffect } from 'react';
import { TimetableSession } from './TimetableData';
import SidebarHeader from '@/components/SidebarHeader';
import { Activity, RefreshCw } from 'lucide-react';
import NoContent from '@/components/NoContent';
import { invoke } from '@tauri-apps/api/core';

export const TimetableSidebar: React.FC = () => {
  const [sessions, setSessions] = useState<TimetableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch today's sessions on component mount
  useEffect(() => {
    fetchTodaySessions();
  }, []);

  const fetchTodaySessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Initialize database if needed
      await invoke('init_database');
      
      // Get all events
      const allEvents = await invoke('get_all_events') as TimetableSession[];
      
      // For now, we'll show all events since we don't have day-specific filtering yet
      setSessions(allEvents);
      
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const refreshSessions = async () => {
    await invoke('refresh_timetable');
    await fetchTodaySessions();
  };

  return (
    <div className="h-full w-64 flex flex-col bg-[#fafafa] pb-2">
      <SidebarHeader title="Today's Sessions" Icon={Activity} />
      {/* Refresh button */}
      <div className="flex gap-2 px-4 py-2 bg-gray-100 border-b border-gray-300">
        <button
          onClick={refreshSessions}
          className="flex items-center gap-2 px-3 py-1 rounded-md font-semibold border border-gray-300 text-xs transition-colors bg-blue-600 text-white shadow hover:bg-blue-700"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>
      
      {/* Sessions list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-600">Loading sessions...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 px-4">
            <div className="text-red-600 text-sm mb-2">Error: {error}</div>
            <button
              onClick={fetchTodaySessions}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <NoContent title="No sessions scheduled" />
        ) : (
          <div className="p-4 space-y-3">
            {sessions.map((session, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-sm text-gray-900">
                    {session.shortCode || session.subject}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {session.start} - {session.end}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Subject:</span>
                    <span>{session.subject}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Location:</span>
                    <span>{session.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Type:</span>
                    <span className="capitalize">{session.event_type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 