import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const SidebarBackground: React.FC = () => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
  const firstDay = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const totalCells = 42; // 6 rows x 7 cols
  type Cell = { day: number; inCurrent: boolean; date: Date };
  const cells: Cell[] = Array.from({ length: totalCells }, (_, i) => {
    const rel = i - startOffset + 1;
    if (rel <= 0) {
      const d = prevMonthDays + rel;
      const date = new Date(currentYear, currentMonth - 1, d);
      return { day: d, inCurrent: false, date };
    }
    if (rel > daysInMonth) {
      const d = rel - daysInMonth;
      const date = new Date(currentYear, currentMonth + 1, d);
      return { day: d, inCurrent: false, date };
    }
    const date = new Date(currentYear, currentMonth, rel);
    return { day: rel, inCurrent: true, date };
  });

  // Mock events keyed by yyyy-mm-dd
  const mockEvents: Record<string, string[]> = {
    // a few sample events
    [`${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`]: ['Today event'],
    [`${currentYear}-${currentMonth + 1}-5`]: ['Meetup'],
    [`${currentYear}-${currentMonth + 1}-12`]: ['Workshop'],
    [`${currentYear}-${currentMonth + 1}-21`]: ['Holiday'],
  };
  const hasEvent = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return !!mockEvents[key];
  };

  function changeMonth(delta: number) {
    let m = currentMonth + delta;
    let y = currentYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCurrentMonth(m);
    setCurrentYear(y);
  }
  return (
    <div className="inset-0 z-2">
<svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="503.759" height="600" viewBox="0 0 503.759 600">
  <defs>
    <clipPath id="clipPath">
      <rect id="bg" width="476.241" height="500" rx="29.5" transform="translate(539.5 289.5)" fill="#1a1a1a" stroke="#000" strokeWidth="1"/>
    </clipPath>
  </defs>
  <g id="CAL" transform="translate(-241.482 -303.953)">
    <g id="main" transform="translate(220 284)">
      <rect id="bg-2" data-name="bg" width="476.241" height="500" rx="29.5" transform="translate(48.5 65.5)" fill="#1a1a1a" stroke="#000" strokeWidth="1"/>
      <g id="control" transform="translate(70 83)">
        <g id="PREVIOUS" fill="#fff" stroke="#707070" strokeWidth="1.5" onClick={() => changeMonth(-1)} style={{ cursor: 'pointer' }}>
          <circle cx="34" cy="34" r="34" stroke="none"/>
          <circle cx="34" cy="34" r="33.5" fill="none"/>
          {/* Lucide icon rendered in a foreignObject for crisp scaling */}
          <foreignObject x="14" y="14" width="40" height="40">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, color: '#1a1a1a' }}>
              <span style={{ display: 'inline-flex' }}>
                {/* Render via React */}
                <ArrowLeft size={40} color="#1a1a1a" />
              </span>
            </div>
          </foreignObject>
        </g>
        <g id="NEXT" transform="translate(72)" fill="#fff" stroke="#707070" strokeWidth="1.5" onClick={() => changeMonth(1)} style={{ cursor: 'pointer' }}>
          <circle cx="34" cy="34" r="34" stroke="none"/>
          <circle cx="34" cy="34" r="33.5" fill="none"/>
          <foreignObject x="14" y="14" width="40" height="40">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, color: '#1a1a1a' }}>
              <span style={{ display: 'inline-flex' }}>
                <ArrowRight size={40} color="#1a1a1a" />
              </span>
            </div>
          </foreignObject>
        </g>
        <text id="MONTH" transform="translate(335.5 43)" fill="#fafafa" stroke="#1a1a1a" strokeWidth="1" fontSize="38" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="-184.972" y="0">{monthName.toUpperCase()}</tspan></text>
        <text id="_YEAR" data-name=",YEAR" transform="translate(443 43)" fill="#fafafa" stroke="#1a1a1a" strokeWidth="1" fontSize="38" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="-98.804" y="0">{`, ${currentYear}`}</tspan></text>
      </g>
    </g>
    <g id="DAYS" transform="translate(279 442)">
      <g id="MON">
        <g id="Rectangle_22" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="M" transform="translate(10 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">M</tspan></text>
      </g>
      <g id="TUE" transform="translate(67)">
        <g id="Rectangle_22-2" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="T" transform="translate(15 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">T</tspan></text>
      </g>
      <g id="WED" transform="translate(134)">
        <g id="Rectangle_22-3" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="W" transform="translate(7 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">W</tspan></text>
      </g>
      <g id="THU" transform="translate(201)">
        <g id="Rectangle_22-4" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="T-2" data-name="T" transform="translate(15 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">T</tspan></text>
      </g>
      <g id="FRID" transform="translate(268)">
        <g id="Rectangle_22-5" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="F" transform="translate(17 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">F</tspan></text>
      </g>
      <g id="SAT" transform="translate(335)">
        <g id="Rectangle_22-6" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="S" transform="translate(16 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">S</tspan></text>
      </g>
      <g id="SUN" transform="translate(402)">
        <g id="Rectangle_22-7" data-name="Rectangle 22" transform="translate(0 1)" fill="#1a1a1a" stroke="#707070" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1">
          <rect width="54" height="51" rx="15" stroke="none"/>
          <rect x="0.5" y="0.5" width="53" height="50" rx="14.5" fill="none"/>
        </g>
        <text id="S-2" data-name="S" transform="translate(16 43)" fill="#fafafa" fontSize="44" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive"><tspan x="0" y="0">S</tspan></text>
      </g>
    </g>
    <g id="Group_97" data-name="Group 97" transform="translate(279 277.063)">
      {cells.map((cell, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const x = col * 67; // spacing similar to weekday boxes
        // Add extra bottom margin by increasing the y offset
        const y = row * 56 + 220 + (row === 5 ? 10 : 0); // Add 10px extra to bottom row only
        const { day, inCurrent, date } = cell;
        const show = true;
        const isToday = (() => {
          if (!show) return false;
          const t = new Date();
          return (
            t.getDate() === day &&
            t.getMonth() === date.getMonth() &&
            t.getFullYear() === date.getFullYear()
          );
        })();
        return (
          <g key={`d-${i}`} transform={`translate(${x} ${y})`}>
            <rect width="54" height="51" rx="15" fill={isToday ? "#ffab2e" : "#90cf81"} stroke="#707070" strokeWidth="1" opacity={inCurrent ? 1 : 0.35}/>
            {show && (
              <text x="27" y="26" fill="#1a1a1a" fontSize="28" textAnchor="middle" dominantBaseline="middle" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive" opacity={inCurrent ? 1 : 0.5}>
                <tspan>{day}</tspan>
              </text>
            )}
            {hasEvent(date) && (
              <g>
                <circle cx="42" cy="10" r="5" fill="#ae100f" stroke="#1a1a1a" strokeWidth="1"/>
              </g>
            )}
          </g>
        );
      })}
    </g>
    <g id="Ebene_x0020_1" transform="translate(241.5 304)">
      <g id="_161098472">
        <path id="_161098904" d="M5.288,57.094H59.247a5.24,5.24,0,0,0,5.271-5.176V8.505a5.24,5.24,0,0,0-5.271-5.176H55.623V9.394a2.321,2.321,0,0,1-2.314,2.314H44.5a2.321,2.321,0,0,1-2.314-2.314V3.329H22.142V9.394a2.321,2.321,0,0,1-2.314,2.314H11.015A2.321,2.321,0,0,1,8.7,9.394V3.329H5.29A5.24,5.24,0,0,0,.018,8.505V51.918A5.24,5.24,0,0,0,5.29,57.094Z" transform="translate(-0.018 6.063)" fill="#da251d" stroke="#1f1a17" strokeWidth={0.036} fillRule="evenodd" />
        <path id="_161098832" d="M6.03,44.848H54.139c2.665,0,4.845-1.642,4.845-3.65V7.885H1.187V41.2c0,2.008,2.18,3.65,4.845,3.65Z" transform="translate(2.157 14.546)" fill="#fff" stroke="#1f1a17" strokeWidth={0.332} fillRule="evenodd" />
        <path id="_161098544" d="M1.2,0H7.195A1.2,1.2,0,0,1,8.4,1.2V14.752a1.2,1.2,0,0,1-1.2,1.2H1.2a1.2,1.2,0,0,1-1.2-1.2V1.2A1.2,1.2,0,0,1,1.2,0Z" transform="translate(11.178)" fill="#da251d" stroke="#1a1a1a" strokeWidth={0.094} />
        <rect id="_161098496" width={8.398} height={15.955} rx={1.203} transform="translate(44.657 0)" fill="#da251d" stroke="#1a1a1a" strokeWidth={0.094} />
        <text id="Month" transform="translate(11 28)" fill="#969594" fontSize={12} fontWeight="bold" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive" textAnchor="middle">
          <tspan x={20} y={6}>{today.toLocaleString('en-US', { month: 'short' }).toUpperCase().padEnd(5).slice(0,5)}</tspan>
        </text>
        <text id="DayNum" transform="translate(11 53)" fill="#1a1a1a" fontSize={25} fontWeight="bold" fontFamily="'luckiest-guy-regular', 'Luckiest Guy', cursive" textAnchor="middle">
          <tspan x={20} y={2}>{today.getDate()}</tspan>
        </text>
      </g>
    </g>
  </g>
</svg>

    </div>
  );
};

export default SidebarBackground;
