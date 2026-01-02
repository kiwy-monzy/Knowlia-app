import React, { useState, useRef, useEffect } from "react"
import { TimetableType, TimetableWeek as WeekType } from './TimetableData';
import { BookOpen, Users, Wrench, GraduationCap, FlaskConical, Microscope, Printer, RefreshCw } from "lucide-react"
import { getTimetablePrintHtml } from './TimetablePrint';
import { invoke } from '@tauri-apps/api/core';
import './Timetable.css';

// Extended TimetableSession type for duration (in hours)
type TimetableSessionWithDuration = {
  subject: string
  location: string
  start: string
  end: string
  type: string
  duration?: number // in hours
  color?: string // for color tab
  shortCode?: string
}

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
]

function parseTime(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function sessionCoversSlot(session: TimetableSessionWithDuration, slot: { start: string; end: string }) {
  return parseTime(session.start) < parseTime(slot.end) && parseTime(session.end) > parseTime(slot.start)
}

function getSessionRowSpan(session: TimetableSessionWithDuration) {
  const sessionStart = parseTime(session.start)
  const sessionEnd = parseTime(session.end)
  let span = 0
  for (const slot of timeSlots) {
    const slotStart = parseTime(slot.start)
    const slotEnd = parseTime(slot.end)
    if (sessionStart < slotEnd && sessionEnd > slotStart) {
      span++
    }
  }
  return span
}

function buildDaySlotMap(daySessions: TimetableSessionWithDuration[]) {
  const map: (TimetableSessionWithDuration | null)[] = Array(timeSlots.length).fill(null)
  daySessions.forEach((session) => {
    const config = sessionTypeConfig[session.type] || sessionTypeConfig.lecture
    for (let i = 0; i < timeSlots.length; i++) {
      if (sessionCoversSlot(session, timeSlots[i])) {
        map[i] = { ...session, color: config.color }
      }
    }
  })
  return map
}


// Add helper function at the top (after parseTime):
function getSessionBlockDayPosition(sessionStart: string, sessionEnd: string, timeSlots: {start: string, end: string}[], rowHeight: number) {
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

export const TimetableView: React.FC = () => {
  // Timetable type state
  const [timetableType, setTimetableType] = useState<TimetableType>('normal');
  // Data states
  const [timetableData, setTimetableData] = useState<WeekType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Normal timetable logic ---
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Fetch timetable data
  const fetchTimetable = async () => {
    try {
      setLoading(true);
      setError(null);
      await invoke('init_database');
      const data = await invoke('fetch_timetable_data') as WeekType;
      setTimetableData(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const refreshTimetable = async () => {
    try {
      setLoading(true);
      await invoke('refresh_timetable');
      await fetchTimetable();
    } catch (err) {
      setError(err as string);
      setLoading(false);
    }
  };

  // --- Exam timetable logic ---
  // (Currently sharing the same days array)

  // --- Today index logic (for both types) ---
  const jsDay = new Date().getDay();
  const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = allDays[jsDay];
  const todayIdx = days.findIndex(day => day === todayName);

  // --- Current time indicator logic ---
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
  const topPx = headerHeight + (offsetMinutes / timetableMinutes) * totalTableHeight;

  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Print function (unchanged for now)
  const handlePrint = () => {
    if (!timetableData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(getTimetablePrintHtml({
      days,
      timeSlots,
      timetableWeek: timetableData.days,
      sessionTypeConfig,
      todayIdx,
      buildDaySlotMap,
      getSessionRowSpan
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // PDF Preview print (from iframe)
  const handlePreviewPrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  // --- UI ---
  return (
    <div className="flex flex-col h-full w-full bg-[#fafafa]">
      <div className="w-full h-full flex flex-col">
        <div className="bg-white overflow-hidden flex-1 flex flex-col">
          {/* Timetable type toggle */}
          <div className="flex gap-2 px-4 py-2 bg-gray-100 border-b border-gray-300">
            <button
              className={`px-3 py-1 rounded-md font-semibold border border-gray-300 text-xs transition-colors ${timetableType === 'normal' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setTimetableType('normal')}
            >
              Normal Timetable
            </button>
            <button
              className={`px-3 py-1 rounded-md font-semibold border border-gray-300 text-xs transition-colors ${timetableType === 'exam' ? 'bg-pink-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setTimetableType('exam')}
            >
              Exam Timetable
            </button>
            <button
              onClick={refreshTimetable}
              disabled={loading}
              className="ml-auto flex items-center gap-2 px-3 py-1 rounded-md font-semibold border border-gray-300 text-xs transition-colors bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="bg-white overflow-hidden flex-1 flex flex-col">
            <div className="bg-gray-100 px-4 md:px-6 py-3 md:py-4 border-b border-gray-300 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">Weekly Timetable</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(true)}
                  className="gap-2 inline-flex items-center px-3 py-2 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-xs shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden md:inline">Preview PDF</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="gap-2 inline-flex items-center px-3 py-2 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-xs shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden md:inline">Print Timetable</span>
                </button>
              </div>
            </div>

            {/* PDF Preview Modal */}
            {showPreview && timetableData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-discord-dark bg-opacity-60">
                <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full h-[90vh] flex flex-col relative">
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-black">PDF Preview</h3>
                    <button onClick={() => setShowPreview(false)} className="text-black text-2xl font-bold">&times;</button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <iframe
                      ref={iframeRef}
                      title="PDF Preview"
                      className="iframe-full"
                      srcDoc={getTimetablePrintHtml({
                        days,
                        timeSlots,
                        timetableWeek: timetableData.days,
                        sessionTypeConfig,
                        todayIdx,
                        buildDaySlotMap,
                        getSessionRowSpan
                      })}
                    />
                  </div>
                  <div className="p-4 border-t flex justify-end gap-2">
                    <button
                      onClick={handlePreviewPrint}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded-lg font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="bg-discord-darkest px-4 md:px-6 py-2 md:py-3 border-b border-black/20">
              <div className="flex flex-wrap gap-2 md:gap-4">
                {Object.entries(sessionTypeConfig).map(([type, config]) => {
                  const IconComponent = config.icon
                  return (
                    <div key={type} className="flex items-center gap-1 md:gap-2">
                      <div className={`${config.color} w-3 h-3 md:w-4 md:h-4 rounded flex items-center justify-center`}>
                        <IconComponent className="w-2 h-2 md:w-2.5 md:h-2.5 text-white" />
                      </div>
                      <span className="text-discord-text text-xs md:text-sm capitalize">{type}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-x-auto flex-1 relative pb-8 md:pb-8">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-lg text-gray-600">Loading timetable...</div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <div className="text-red-600 text-lg mb-4">Error: {error}</div>
                  <button
                    onClick={fetchTimetable}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="min-h-full pb-6">
                {/* Only show the Now label and dotted line once, positioned absolutely over the table */}
                {showIndicator && (
                  <div
                    className="absolute left-0 w-full pointer-events-none"
                    style={{
                      top: `${topPx}px`,
                      zIndex: 50,
                      height: 0,
                    }}
                  >
                    {/* Dotted line across the row */}
                    <div className="time-indicator-line" />
                    {/* Center the label above the vertical time header (first column) */}
                    <div className="time-indicator-label">
                      <span style={{
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        background: '#ff3b3b',
                        borderRadius: '6px',
                        marginBottom: '2px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}>
                        {now.getMinutes().toString().padStart(2, '0')}
                      </span>
                      <div className="time-indicator-dot" />
                    </div>
                  </div>
                )}
                <table className="w-full border-x border-gray-300 min-w-[500px] bg-white text-sm md:text-base table-fixed pb-12">
                  <thead className="sticky top-0 z-20 bg-gray-100 ">
                    <tr className="bg-white border-b border-gray-300">
                      <th className="text-gray-900 py-2 text-center font-semibold sticky left-0 bg-gray-100 z-30 border-r border-gray-300 w-[80px] min-w-[80px] max-w-[80px] text-sm md:text-base">
                        Time
                      </th>
                      {days.map((day, idx) => {
                        const isToday = idx === todayIdx;
                        return (
                          <th
                            key={day}
                            className={`border-x border-gray-300 py-2 text-center font-semibold w-1/5 min-w-[120px] max-w-[200px] ${idx > 1 ? 'hidden md:table-cell' : ''} sticky top-0 z-20 text-sm md:text-base ${
                              isToday 
                                ? 'bg-blue-100 text-gray-900' 
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {day}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot, rowIdx) => (
                      <tr key={slot.start} className={`border border-black/20`}>
                        {/* Time column */}
                        <td
                          className=" text-gray-900 font-semibold bg-gray-100 sticky left-0 z-10 border border-gray-300 align-middle w-[80px] min-w-[80px] max-w-[80px] text-sm md:text-base"
                          style={{ height: `${rowHeight}px` }}
                        >
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm md:text-base font-bold writing-mode-vertical">
                              {slot.start}
                            </div>
                          </div>
                        </td>
                        {/* Day columns: only render the session container in the first row, empty cells otherwise */}
                        {days.map((day, colIdx) => {
                          if (colIdx > 1 && typeof window !== 'undefined' && window.innerWidth < 768) return null;
                          if (rowIdx === 0) {
                            // For the first row, render the session container for the whole day
                            const sessionsForThisDay = timetableData?.days.find(d => d.day === day)?.sessions || [];
                            return (
                              <td
                                key={day}
                                className="border border-gray-300 align-top bg-white"
                                style={{ position: 'relative', height: `${rowHeight * timeSlots.length}px`, minHeight: `${rowHeight * timeSlots.length}px` }}
                                rowSpan={timeSlots.length}
                              >
                                {timeSlots.map((_, idx) => (
                                  <div key={`slot-line-${idx}`} className="slot-line" style={{ top: `${idx * rowHeight}px` }} />
                                ))}
                                {timeSlots.map((_, idx) => (
                                  <div key={`half-slot-line-${idx}`} className="half-slot-line" style={{ top: `${idx * rowHeight + rowHeight / 2}px` }} />
                                ))}
                                {sessionsForThisDay.map((session: any, idx: number) => {
                                  const config = sessionTypeConfig[session.type] || sessionTypeConfig.lecture;
                                  const pos = getSessionBlockDayPosition(
                                    session.start,
                                    session.end,
                                    timeSlots,
                                    rowHeight
                                  );
                                  if (!pos) return null;
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
                                      }}
                                    >
                                      <div className="flex items-center justify-center flex-1 w-full">
                                        <div className="text-center">
                                          <div className="font-bold text-white text-sm leading-tight mb-1">
                                            {session.shortCode}
                                          </div>
                                          <div className="text-sm text-white text-opacity-90">
                                            {session.location}
                                          </div>
                                          <div className="text-sm text-white text-opacity-70 capitalize">
                                            {session.type}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          } else {
                            // For all other rows, render empty cells
                            return (
                              <td
                                key={day + '-' + rowIdx}
                                className="border border-gray-300 w-1/5 min-w-[120px] max-w-[200px] bg-white empty-cell"
                                style={{ height: `${rowHeight}px` }}
                              ></td>
                            );
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimetableView;
