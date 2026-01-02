import React, { useState, useEffect } from "react"
import { TimetableWeek, TimetableSession } from './TimetableData';
import { BookOpen, Users, Wrench, GraduationCap, FlaskConical, Microscope, RefreshCw } from "lucide-react"
import { invoke } from '@tauri-apps/api/core';
import './Timetable.css';

// Session type to color and icon mapping
const sessionTypeConfig: Record<string, { color: string; icon: React.ComponentType<any> }> = {
  lecture: {
    color: "bg-blue-600",
    icon: BookOpen,
  },
  seminar: {
    color: "bg-emerald-600",
    icon: Users,
  },
  tutorial: {
    color: "bg-purple-600",
    icon: GraduationCap,
  },
  practical: {
    color: "bg-orange-600",
    icon: Wrench,
  },
  lab: {
    color: "bg-pink-600",
    icon: FlaskConical,
  },
  workshop: {
    color: "bg-indigo-600",
    icon: Microscope,
  },
  examination: {
    color: "bg-red-600",
    icon: BookOpen,
  },
}

// Define hourly intervals for timetable slots
const timeSlots = [
  { start: "07:00", end: "08:00" },
  { start: "08:00", end: "09:00" },
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
  { start: "17:00", end: "18:00" },
  { start: "18:00", end: "19:00" },
  { start: "19:00", end: "20:00" },
  { start: "20:00", end: "21:00" },
];

// Helper function to parse time strings (e.g., "07:00") into minutes
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to get session block position and height
function getSessionBlockPosition(sessionStart: string, sessionEnd: string, timeSlots: {start: string, end: string}[], rowHeight: number) {
  const slotStartMin = parseTime(timeSlots[0].start);
  const slotEndMin = parseTime(timeSlots[timeSlots.length - 1].end);
  const sessionStartMin = Math.max(parseTime(sessionStart), slotStartMin);
  const sessionEndMin = Math.min(parseTime(sessionEnd), slotEndMin);
  const totalMinutes = slotEndMin - slotStartMin;
  const offsetMin = sessionStartMin - slotStartMin;
  const blockMin = sessionEndMin - sessionStartMin;
  const offsetPx = (offsetMin / totalMinutes) * (rowHeight * timeSlots.length);
  const blockPx = (blockMin / totalMinutes) * (rowHeight * timeSlots.length);
  return { offsetPx, blockPx };
}

export const UnifiedTimetableView: React.FC = () => {
  const [timetableData, setTimetableData] = useState<TimetableWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Fetch timetable data on component mount
  useEffect(() => {
    fetchTimetableData();
  }, []);

  const fetchTimetableData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Initialize database if needed
      await invoke('init_database');
      
      // Fetch timetable data
      const data = await invoke('fetch_timetable_data') as TimetableWeek;
      setTimetableData(data);
      
      // Get database statistics
      const dbStats = await invoke('get_database_stats');
      setStats(dbStats);
      
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      await invoke('refresh_timetable');
      await fetchTimetableData();
    } catch (err) {
      setError(err as string);
    }
  };

  // Calculate today's index and current time indicator
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const jsDay = new Date().getDay();
  const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = allDays[jsDay];
  const todayIdx = days.findIndex(day => day === todayName);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timetableStart = parseTime(timeSlots[0].start);
  const timetableEnd = parseTime(timeSlots[timeSlots.length - 1].end);
  const showIndicator = todayIdx !== -1 && currentMinutes >= timetableStart && currentMinutes <= timetableEnd;
  const rowHeight = 80;
  const headerHeight = 40;
  const timetableMinutes = timetableEnd - timetableStart;
  const offsetMinutes = currentMinutes - timetableStart;
  const totalTableHeight = rowHeight * timeSlots.length;
  const currentIndicatorTop = headerHeight + (offsetMinutes / timetableMinutes) * totalTableHeight;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading timetable data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-600 text-lg mb-4">Error: {error}</div>
        <button
          onClick={fetchTimetableData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!timetableData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">No timetable data available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with stats and refresh */}
      <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
        <div>
          <h2 className="text-xl font-bold">{timetableData.week}</h2>
          {stats && (
            <div className="text-sm text-gray-600">
              Total events: {stats.events || 0}
            </div>
          )}
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Timetable */}
      <div className="flex-1 overflow-auto p-4">
        <div className="relative">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-gray-900 font-semibold bg-gray-100 sticky left-0 z-10 border border-gray-300 align-middle w-[80px] min-w-[80px] max-w-[80px] text-sm md:text-base">
                  Time
                </th>
                {days.map((day, idx) => (
                  <th
                    key={day}
                    className={`text-gray-900 font-semibold border border-gray-300 align-middle w-1/5 min-w-[120px] max-w-[200px] text-sm md:text-base ${
                      todayIdx === idx
                        ? 'bg-blue-100 text-gray-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, rowIdx) => (
                <tr key={slot.start} className={`border border-black/20`}>
                  {/* Time column */}
                  <td
                    className="text-gray-900 font-semibold bg-gray-100 sticky left-0 z-10 border border-gray-300 align-middle w-[80px] min-w-[80px] max-w-[80px] text-sm md:text-base"
                    style={{ height: `${rowHeight}px` }}
                  >
                    <div className="flex items-center justify-center h-full">
                      <div className="text-sm md:text-base font-bold">
                        {slot.start}
                      </div>
                    </div>
                  </td>

                  {/* Day columns */}
                  {days.map((day) => {
                    const dayData = timetableData.days.find(d => d.day === day);
                    const sessions = dayData?.sessions || [];
                    
                    // Find sessions that span this time slot
                    const sessionsInSlot = sessions.filter(session => {
                      const sessionStart = parseTime(session.start);
                      const sessionEnd = parseTime(session.end);
                      const slotStart = parseTime(slot.start);
                      const slotEnd = parseTime(slot.end);
                      return sessionStart < slotEnd && sessionEnd > slotStart;
                    });

                    return (
                      <td
                        key={`${day}-${rowIdx}`}
                        className="border border-gray-300 w-1/5 min-w-[120px] max-w-[200px] bg-white relative"
                        style={{ height: `${rowHeight}px` }}
                      >
                        {rowIdx === 0 && sessionsInSlot.length > 0 && (
                          <div className="relative h-full">
                            {sessionsInSlot.map((session, idx) => {
                              const eventType = session.event_type || 'lecture';
                              const config = sessionTypeConfig[eventType] || sessionTypeConfig.lecture;
                              const pos = getSessionBlockPosition(session.start, session.end, timeSlots, rowHeight);
                              
                              return (
                                <div
                                  key={idx}
                                  className={`${config.color} rounded-lg shadow hover:shadow-lg transition-all duration-200 flex flex-col justify-center items-center text-center session-block`}
                                  style={{
                                    position: 'absolute',
                                    top: `${pos.offsetPx}px`,
                                    height: `${pos.blockPx}px`,
                                    minHeight: '20px',
                                    maxHeight: `${rowHeight * timeSlots.length}px`,
                                    overflow: 'hidden',
                                    zIndex: 2,
                                    left: '4px',
                                    right: '4px',
                                  }}
                                >
                                  <div className="flex items-center justify-center flex-1 w-full">
                                    <div className="text-center">
                                      <div className="font-bold text-white text-sm leading-tight mb-1">
                                        {session.shortCode || session.subject}
                                      </div>
                                      <div className="text-sm text-white text-opacity-90">
                                        {session.location}
                                      </div>
                                      <div className="text-sm text-white text-opacity-70 capitalize">
                                        {session.event_type}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Current time indicator */}
          {showIndicator && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-red-500 z-20"
              style={{
                top: `${currentIndicatorTop}px`,
              }}
            >
              <div className="absolute -left-2 -top-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-red-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
