import React, { useState, useRef, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import { InfoTip } from "./InfoTip";
import { useFloating } from "./useFloating";
import { titleCase } from "../../utilities/titleCase";

export const DatePicker = ({
  label,
  id,
  value, // Expects YYYY-MM-DD string
  onChange, // Passes YYYY-MM-DD string
  required = false,
  disabled = false,
  placeholder = "Select date…",
  error = null,
  className = "",
  size = "md", // sm | md
  hint = null, // short explanation, shown from an ⓘ next to the label
  min = null, // YYYY-MM-DD: earliest date that can be picked (e.g. "not before the start date")
  max = null, // YYYY-MM-DD: latest date that can be picked (e.g. today for "received")
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const fieldRef = useRef(null);
  // The calendar floats on top of the page (never cut off by a popup), under
  // the field or above it when there is no room below.
  const { floatRef, style: calendarStyle } = useFloating(fieldRef, open);

  // Parse current date value
  const parsedDate = value ? new Date(value) : null;
  const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

  // Calendar navigation state (default to current month/year)
  const today = new Date();
  const [navMonth, setNavMonth] = useState(
    isValidDate ? parsedDate.getMonth() : today.getMonth(),
  );
  const [navYear, setNavYear] = useState(
    isValidDate ? parsedDate.getFullYear() : today.getFullYear(),
  );

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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target) && !floatRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [floatRef]);

  // Dates compare as YYYY-MM-DD strings.
  const ymdOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayYmd = ymdOf(today.getFullYear(), today.getMonth(), today.getDate());
  const outOfRange = (ymd) => !!((min && ymd < min) || (max && ymd > max));
  const monthOutOfRange = (y, m) => !!((min && ymdOf(y, m, 31) < min) || (max && ymdOf(y, m, 1) > max));

  // Opening with no date while today is outside the limits shows the nearest allowed month.
  const toggleOpen = () => {
    if (disabled) return;
    if (!open && !isValidDate) {
      const edge = max && todayYmd > max ? max : min && todayYmd < min ? min : null;
      if (edge) {
        setNavYear(Number(edge.slice(0, 4)));
        setNavMonth(Number(edge.slice(5, 7)) - 1);
      }
    }
    setOpen(!open);
  };

  // A year change can land on a month outside the limits: move to the nearest allowed one.
  const goTo = (y, m) => {
    if (min && ymdOf(y, m, 31) < min && Number(min.slice(0, 4)) === y) m = Number(min.slice(5, 7)) - 1;
    if (max && ymdOf(y, m, 1) > max && Number(max.slice(0, 4)) === y) m = Number(max.slice(5, 7)) - 1;
    setNavYear(y);
    setNavMonth(m);
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 0) goTo(navYear - 1, 11);
    else goTo(navYear, navMonth - 1);
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 11) goTo(navYear + 1, 0);
    else goTo(navYear, navMonth + 1);
  };

  const prevDisabled = navMonth === 0 ? monthOutOfRange(navYear - 1, 11) : monthOutOfRange(navYear, navMonth - 1);
  const nextDisabled = navMonth === 11 ? monthOutOfRange(navYear + 1, 0) : monthOutOfRange(navYear, navMonth + 1);

  // Year list: 100 years back (dates of birth) to 10 ahead, within the limits.
  const firstYear = min ? Number(min.slice(0, 4)) : Math.min(today.getFullYear() - 100, navYear);
  const lastYear = max ? Number(max.slice(0, 4)) : Math.max(today.getFullYear() + 10, navYear);
  const years = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);

  const handleSelectDay = (day) => {
    const ymd = ymdOf(navYear, navMonth, day);
    if (outOfRange(ymd)) return;
    onChange?.(ymd);
    setOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    if (outOfRange(todayYmd)) return;
    onChange?.(todayYmd);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.("");
    setOpen(false);
  };

  // Calendar dates generation
  const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
  const firstDayIndex = new Date(navYear, navMonth, 1).getDay(); // Day of week index (0 = Sun, 6 = Sat)

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Render grid of days
  const calendarCells = [];
  // Fill preceding padding blank days
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="h-8 w-8" />);
  }
  // Fill active month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected =
      isValidDate &&
      parsedDate.getDate() === d &&
      parsedDate.getMonth() === navMonth &&
      parsedDate.getFullYear() === navYear;

    const isCurrentToday =
      today.getDate() === d &&
      today.getMonth() === navMonth &&
      today.getFullYear() === navYear;
    const isBlocked = outOfRange(ymdOf(navYear, navMonth, d));

    calendarCells.push(
      <button
        key={`day-${d}`}
        type="button"
        disabled={isBlocked}
        onClick={() => handleSelectDay(d)}
        className={`h-8 w-8 text-xs font-semibold rounded-[4px] flex items-center justify-center transition-colors duration-100
          ${
            isBlocked
              ? "text-gray-300 cursor-not-allowed"
              : isSelected
                ? "bg-brand-accent text-white border border-brand-accent shadow-sm cursor-pointer"
                : isCurrentToday
                  ? "border border-brand-accent text-brand-accent bg-brand-accent/5 cursor-pointer"
                  : "text-brand-primary hover:bg-surface-hover cursor-pointer"
          }
        `}
      >
        {d}
      </button>,
    );
  }

  // Format display text (DD/MM/YYYY)
  const displayValue = isValidDate
    ? `${String(parsedDate.getDate()).padStart(2, "0")}/${String(parsedDate.getMonth() + 1).padStart(2, "0")}/${parsedDate.getFullYear()}`
    : "";

  return (
    <div ref={wrapperRef} className={`flex flex-col relative ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-status-muted mb-1 flex items-center gap-0.5"
        >
          {titleCase(label)}
          {required && <span className="text-status-danger">*</span>}
          {hint && <InfoTip text={hint} className="ml-1" />}
        </label>
      )}

      {/* Input Field trigger */}
      <div ref={fieldRef} className="relative w-full">
        <input
          id={id}
          type="text"
          readOnly
          disabled={disabled}
          value={displayValue}
          onClick={toggleOpen}
          placeholder={placeholder}
          className={`
            w-full text-sm font-sans card-bg border rounded-[4px] pl-3 pr-10 cursor-pointer transition-all duration-150 focus:outline-none
            ${size === "sm" ? "h-8 py-1" : "py-[10px]"}
            ${
              error
                ? "border-status-danger text-text-primary focus:ring-2 focus:ring-status-danger/20"
                : disabled
                  ? "border-border-color bg-border-color/10 text-status-muted cursor-not-allowed"
                  : open
                    ? "border-brand-accent ring-2 ring-brand-accent/15 text-text-primary"
                    : "border-border-color text-text-primary hover:border-gray-400"
            }
          `}
          {...props}
        />

        {/* Calendar Icon overlay */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <CalendarIcon size={14} />
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <span className="text-xs text-status-danger mt-1 font-semibold">
          {error}
        </span>
      )}

      {/* Calendar Overlay Pop-up */}
      {open && createPortal(
        <div ref={floatRef} style={calendarStyle} className="card-bg border border-card-border rounded-xl shadow-xl p-4 w-72 flex flex-col gap-3 select-none">
          {/* Header Month / Year control */}
          <div className="flex items-center justify-between border-b pb-2 border-card-border">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={prevDisabled}
              aria-label="Previous month"
              className="p-1 hover:bg-surface-hover rounded text-status-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1">
              <select
                aria-label="Month"
                value={navMonth}
                onChange={(e) => goTo(navYear, Number(e.target.value))}
                className="font-bold text-sm text-text-primary card-bg border border-transparent hover:border-card-border rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:border-brand-accent"
              >
                {monthNames.map((name, i) => (
                  <option key={name} value={i} disabled={monthOutOfRange(navYear, i)}>{name}</option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={navYear}
                onChange={(e) => goTo(Number(e.target.value), navMonth)}
                className="font-bold text-sm text-text-primary card-bg border border-transparent hover:border-card-border rounded px-1 py-0.5 cursor-pointer focus:outline-none focus:border-brand-accent"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={nextDisabled}
              aria-label="Next month"
              className="p-1 hover:bg-surface-hover rounded text-status-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-2xs font-bold text-gray-400">
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
          <div className="flex justify-between border-t pt-2 border-card-border mt-1">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-gray-400 hover:text-text-primary cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              disabled={outOfRange(todayYmd)}
              className="text-xs font-bold text-brand-accent hover:underline cursor-pointer disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
