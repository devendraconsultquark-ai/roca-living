import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export const DatePicker = ({
  label,
  id,
  value, // Expects YYYY-MM-DD string
  onChange, // Passes YYYY-MM-DD string
  required = false,
  disabled = false,
  placeholder = 'Select date…',
  error = null,
  className = '',
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Parse current date value
  const parsedDate = value ? new Date(value) : null;
  const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

  // Calendar navigation state (default to current month/year)
  const today = new Date();
  const [navMonth, setNavMonth] = useState(isValidDate ? parsedDate.getMonth() : today.getMonth());
  const [navYear, setNavYear] = useState(isValidDate ? parsedDate.getFullYear() : today.getFullYear());

  // Synchronize navigation view with value updates
  useEffect(() => {
    if (isValidDate) {
      setNavMonth(parsedDate.getMonth());
      setNavYear(parsedDate.getFullYear());
    }
  }, [value]);

  // Outside click handler to close menu
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear(navYear - 1);
    } else {
      setNavMonth(navMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear(navYear + 1);
    } else {
      setNavMonth(navMonth + 1);
    }
  };

  const handleSelectDay = (day) => {
    const selectedDate = new Date(navYear, navMonth, day);
    // Format to YYYY-MM-DD with local timezone safety
    const offset = selectedDate.getTimezoneOffset();
    const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
    const ymd = localDate.toISOString().split('T')[0];
    onChange?.(ymd);
    setOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    const ymd = localDate.toISOString().split('T')[0];
    onChange?.(ymd);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('');
    setOpen(false);
  };

  // Calendar dates generation
  const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
  const firstDayIndex = new Date(navYear, navMonth, 1).getDay(); // Day of week index (0 = Sun, 6 = Sat)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Render grid of days
  const calendarCells = [];
  // Fill preceding padding blank days
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  // Fill active month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = isValidDate && 
      parsedDate.getDate() === d && 
      parsedDate.getMonth() === navMonth && 
      parsedDate.getFullYear() === navYear;

    const isCurrentToday = today.getDate() === d &&
      today.getMonth() === navMonth &&
      today.getFullYear() === navYear;

    calendarCells.push(
      <button
        key={`day-${d}`}
        type="button"
        onClick={() => handleSelectDay(d)}
        className={`h-8 w-8 text-xs font-semibold rounded-[4px] flex items-center justify-center cursor-pointer transition-colors duration-100
          ${isSelected 
            ? 'bg-brand-accent text-white border border-brand-accent shadow-sm' 
            : isCurrentToday 
              ? 'border border-brand-accent text-brand-accent bg-brand-accent/5' 
              : 'text-gray-700 hover:bg-gray-100'
          }
        `}
      >
        {d}
      </button>
    );
  }

  // Format display text (DD/MM/YYYY)
  const displayValue = isValidDate 
    ? `${String(parsedDate.getDate()).padStart(2, '0')}/${String(parsedDate.getMonth() + 1).padStart(2, '0')}/${parsedDate.getFullYear()}` 
    : '';

  return (
    <div ref={wrapperRef} className={`flex flex-col w-full relative ${className}`}>
      {/* Label */}
      {label && (
        <label 
          htmlFor={id} 
          className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-0.5"
        >
          {label}
          {required && <span className="text-status-danger">*</span>}
        </label>
      )}

      {/* Input Field trigger */}
      <div className="relative w-full">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={displayValue}
          onClick={() => !disabled && setOpen(!open)}
          placeholder={placeholder}
          className={`
            w-full text-sm font-sans bg-white border rounded-[4px] py-[10px] pl-3 pr-10 cursor-pointer transition-all duration-150 focus:outline-none
            ${error 
              ? 'border-status-danger text-[#1A1A1A] focus:ring-2 focus:ring-status-danger/20' 
              : disabled 
                ? 'border-border-color bg-border-color/10 text-status-muted cursor-not-allowed' 
                : open 
                  ? 'border-brand-accent ring-2 ring-brand-accent/15 text-[#1A1A1A]' 
                  : 'border-border-color text-[#1A1A1A] hover:border-gray-400'
            }
          `}
          {...props}
        />

        {/* Calendar Icon overlay */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <CalendarIcon size={16} />
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <span className="text-xs text-status-danger mt-1 font-semibold">{error}</span>
      )}

      {/* Calendar Overlay Pop-up */}
      {open && (
        <div className="absolute z-50 mt-1 top-full left-0 bg-white border border-border-color rounded-xl shadow-xl p-4 w-72 flex flex-col gap-3 select-none">
          {/* Header Month / Year control */}
          <div className="flex items-center justify-between border-b pb-2 border-gray-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="font-bold text-sm text-[#1A1A1A]">
              {monthNames[navMonth]} {navYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-1 justify-items-center">
            {calendarCells}
          </div>

          {/* Footer Controls */}
          <div className="flex justify-between border-t pt-2 border-gray-100 mt-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-bold text-brand-accent hover:underline cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
