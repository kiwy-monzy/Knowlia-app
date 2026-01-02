import React, { useState } from 'react';

interface CalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

type ViewMode = 'calendar' | 'month' | 'year';

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect }) => {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDateState, setSelectedDateState] = useState(selectedDate || new Date());

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday (0) to 6, Monday (1) to 0
  };

  const getPreviousMonthDays = (date: Date) => {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1);
    const daysInPrevMonth = getDaysInMonth(prevMonth);
    const firstDayOfCurrentMonth = getFirstDayOfMonth(date);
    
    const days = [];
    for (let i = daysInPrevMonth - firstDayOfCurrentMonth + 1; i <= daysInPrevMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getNextMonthDays = (date: Date) => {
    const daysInCurrentMonth = getDaysInMonth(date);
    const firstDayOfCurrentMonth = getFirstDayOfMonth(date);
    const totalCells = Math.ceil((daysInCurrentMonth + firstDayOfCurrentMonth) / 7) * 7;
    const nextMonthDays = totalCells - daysInCurrentMonth - firstDayOfCurrentMonth;
    
    const days = [];
    for (let i = 1; i <= nextMonthDays; i++) {
      days.push(i);
    }
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateDecade = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setFullYear(newDate.getFullYear() - 10);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 10);
    }
    setCurrentDate(newDate);
  };

  const selectMonth = (monthIndex: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
    setViewMode('calendar');
  };

  const selectYear = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
    setViewMode('calendar');
  };

  const selectDate = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDateState(newDate);
    onDateSelect?.(newDate);
  };

  const getYearRange = () => {
    const year = currentDate.getFullYear();
    const startYear = Math.floor(year / 10) * 10;
    return { start: startYear, end: startYear + 9 };
  };

  const renderCalendarView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const prevMonthDays = getPreviousMonthDays(currentDate);
    const nextMonthDays = getNextMonthDays(currentDate);
    
    const allDays = [
      ...prevMonthDays.map(day => ({ day, isCurrentMonth: false, isPrevMonth: true })),
      ...Array.from({ length: daysInMonth }, (_, i) => ({ 
        day: i + 1, 
        isCurrentMonth: true, 
        isPrevMonth: false 
      })),
      ...nextMonthDays.map(day => ({ day, isCurrentMonth: false, isPrevMonth: false }))
    ];

    return (
      <div className=" mx-auto max-w-[500px] min-h-[600px]  bg-[#fafafa] rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setViewMode('month')}
            className="text-gray-800 hover:text-gray-600 transition-colors font-bold text-xl tracking-wide"
          >
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigateMonth('prev')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Previous month"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Next month"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {daysOfWeek.map(day => (
            <div key={day} className="text-gray-600 text-sm text-center py-3 font-semibold uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {allDays.map(({ day, isCurrentMonth }, index) => {
            const isSelected = isCurrentMonth && 
              selectedDateState.getDate() === day &&
              selectedDateState.getMonth() === currentDate.getMonth() &&
              selectedDateState.getFullYear() === currentDate.getFullYear();

            return (
              <button
                key={index}
                onClick={() => isCurrentMonth && selectDate(day)}
                className={`
                  py-4 px-2 text-sm transition-all duration-200 rounded-xl font-medium
                  ${isCurrentMonth 
                    ? 'text-gray-800 hover:bg-gray-50 hover:shadow-sm' 
                    : 'text-gray-400'
                  }
                  ${isSelected 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:from-blue-600 hover:to-blue-700 transform hover:scale-105' 
                    : ''
                  }
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-800 text-xl font-bold tracking-wide">{currentDate.getFullYear()}</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigateYear('prev')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Previous year"
              aria-label="Previous year"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => navigateYear('next')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Next year"
              aria-label="Next year"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-4 gap-3">
          {months.map((month, index) => {
            const isSelected = index === currentDate.getMonth();
            return (
              <button
                key={month}
                onClick={() => selectMonth(index)}
                className={`
                  py-4 px-3 text-sm transition-all duration-200 rounded-xl font-semibold uppercase tracking-wide
                  ${isSelected 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transform hover:scale-105' 
                    : 'text-gray-800 hover:bg-gray-50 hover:shadow-sm'
                  }
                `}
              >
                {month}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const { start, end } = getYearRange();
    const years = [];
    
    // Add previous decade years
    for (let i = start - 3; i < start; i++) {
      years.push({ year: i, isCurrentDecade: false });
    }
    
    // Add current decade years
    for (let i = start; i <= end; i++) {
      years.push({ year: i, isCurrentDecade: true });
    }
    
    // Add next decade years
    for (let i = end + 1; i <= end + 3; i++) {
      years.push({ year: i, isCurrentDecade: false });
    }

    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-800 text-xl font-bold tracking-wide">{start} - {end}</span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigateDecade('prev')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Previous decade"
              aria-label="Previous decade"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => navigateDecade('next')}
              className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
              title="Next decade"
              aria-label="Next decade"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Year grid */}
        <div className="grid grid-cols-4 gap-3">
          {years.map(({ year, isCurrentDecade }) => {
            const isSelected = year === currentDate.getFullYear();
            return (
              <button
                key={year}
                onClick={() => selectYear(year)}
                className={`
                  py-4 px-3 text-sm transition-all duration-200 rounded-xl font-semibold
                  ${isCurrentDecade ? 'text-gray-800' : 'text-gray-400'}
                  ${isSelected 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transform hover:scale-105' 
                    : 'hover:bg-gray-50 hover:shadow-sm'
                  }
                `}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Background with geometric pattern */}
      <div className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-200"></div>
      
      {/* Geometric pattern overlay */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <svg className="w-full h-full opacity-5" viewBox="0 0 400 300" preserveAspectRatio="none">
          <defs>
            <pattern id="geometric-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="3" fill="#ff6b6b" />
              <rect x="15" y="15" width="10" height="10" fill="#4ecdc4" opacity="0.7" />
              <polygon points="20,5 25,15 15,15" fill="#45b7d1" opacity="0.6" />
              <circle cx="5" cy="5" r="2" fill="#f9ca24" />
              <rect x="30" y="30" width="8" height="8" fill="#6c5ce7" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric-pattern)" />
        </svg>
      </div>
      
      {/* Content */}
      <div className="relative z-10 p-10 mx-auto max-w-[600px] min-h-[600px] max-w-5xl">
        {viewMode === 'calendar' && renderCalendarView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'year' && renderYearView()}
      </div>
    </div>
  );
};

export default Calendar;
