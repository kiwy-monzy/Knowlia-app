// TimetablePrint.ts
// Generates the print HTML for the timetable

export interface TimetablePrintProps {
  days: string[];
  timeSlots: { start: string; end: string }[];
  timetableWeek: { day: string; sessions: any[] }[];
  sessionTypeConfig: Record<string, { color: string }>;
  todayIdx: number;
  buildDaySlotMap: (sessions: any[]) => any[];
  getSessionRowSpan: (session: any) => number;
}

export function getTimetablePrintHtml({ 
  days, 
  timeSlots, 
  timetableWeek, 
  sessionTypeConfig, 
  todayIdx, 
  buildDaySlotMap, 
  getSessionRowSpan 
}: TimetablePrintProps) {
  const skipCells = days.map(() => Array(timeSlots.length).fill(0));
  let printTableRows = '';
  for (let rowIdx = 0; rowIdx < timeSlots.length; rowIdx++) {
    printTableRows += '<tr>';
    printTableRows += `<td class="time-cell"><div>${timeSlots[rowIdx].start}</div><div style="font-size: 8px; color: #666;">${timeSlots[rowIdx].end}</div></td>`;
    for (let colIdx = 0; colIdx < days.length; colIdx++) {
      if (skipCells[colIdx][rowIdx]) continue;
      const session = buildDaySlotMap((timetableWeek.find(d => d.day === days[colIdx])?.sessions) || [])[rowIdx];
      const isToday = colIdx === todayIdx;
      if (session) {
        if (rowIdx === 0 || buildDaySlotMap((timetableWeek.find(d => d.day === days[colIdx])?.sessions) || [])[rowIdx - 1] !== session) {
          const rowSpan = getSessionRowSpan(session);
          for (let i = 1; i < rowSpan; i++) {
            if (rowIdx + i < timeSlots.length) skipCells[colIdx][rowIdx + i] = 1;
          }
          const config = sessionTypeConfig[session.type] || sessionTypeConfig.lecture;
          const bgColor = config.color.replace('bg-', '').includes('blue') ? '#2563eb' : 
            config.color.replace('bg-', '').includes('emerald') ? '#059669' :
            config.color.replace('bg-', '').includes('purple') ? '#7c3aed' :
            config.color.replace('bg-', '').includes('orange') ? '#ea580c' :
            config.color.replace('bg-', '').includes('pink') ? '#db2777' :
            config.color.replace('bg-', '').includes('indigo') ? '#4f46e5' : '#2563eb';
          printTableRows += `<td class="session-cell${isToday ? ' today-cell' : ''}" rowspan="${rowSpan}" style="background:${bgColor};color:#fff;">
            <div class="session-content">
              <div class="session-subject">${session.shortCode || session.subject}</div>
              <div class="session-location">${session.location}</div>
              <div class="session-type">${session.type}</div>
            </div>
          </td>`;
        }
      } else {
        printTableRows += `<td class="${isToday ? 'today-cell' : ''}"></td>`;
      }
    }
    printTableRows += '</tr>';
  }
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Weekly Timetable</title>
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 1cm;
            }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .print-header h1 {
            margin: 0;
            font-size: 24px;
            color: #333;
          }
          .print-legend {
            margin-bottom: 15px;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: center;
          }
          .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
          }
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
          }
          .timetable-container {
            width: 100%;
            overflow-x: auto;
          }
          .timetable {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .timetable th {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 8px 4px;
            text-align: center;
            font-weight: bold;
            color: #333;
          }
          .timetable td {
            border: 1px solid #ccc;
            padding: 4px;
            vertical-align: top;
            height: 60px;
          }
          .time-cell {
            background: #f8f8f8;
            font-weight: bold;
            text-align: center;
            width: 80px;
          }
          .session-cell {
            padding: 2px;
          }
          .session-content {
            border-radius: 4px;
            padding: 4px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: white;
            font-size: 9px;
          }
          .session-subject {
            font-weight: bold;
            margin-bottom: 1px;
          }
          .session-location {
            font-size: 8px;
            opacity: 0.9;
          }
          .session-type {
            font-size: 8px;
            opacity: 0.7;
            text-transform: capitalize;
          }
          .today-column {
            /* No background for print */
          }
          .today-cell {
            /* No background for print */
          }
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Weekly Timetable</h1>
        </div>
        <div class="print-legend">
          ${Object.entries(sessionTypeConfig).map(([type, config]) => `
            <div class="legend-item">
              <div class="legend-color" style="background: ${config.color.replace('bg-', '').includes('blue') ? '#2563eb' : 
                config.color.replace('bg-', '').includes('emerald') ? '#059669' :
                config.color.replace('bg-', '').includes('purple') ? '#7c3aed' :
                config.color.replace('bg-', '').includes('orange') ? '#ea580c' :
                config.color.replace('bg-', '').includes('pink') ? '#db2777' :
                config.color.replace('bg-', '').includes('indigo') ? '#4f46e5' : '#2563eb'}"></div>
              <span>${type}</span>
            </div>
          `).join('')}
        </div>
        <div class="timetable-container">
          <table class="timetable">
            <thead>
              <tr>
                <th class="time-cell">Time</th>
                ${days.map((day, idx) => `<th class="${idx === todayIdx ? 'today-column' : ''}">${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${printTableRows}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
} 