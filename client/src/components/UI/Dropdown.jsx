import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Check, X, Search, ChevronsUpDown } from 'lucide-react';

/**
 * Dropdown — Universal custom select component.
 *
 * Props:
 *  options      {Array}   REQUIRED. Array of { value, label, icon?, disabled?, group? }
 *  value        {*}       Controlled value (string/number) or array for multiple
 *  onChange     {fn}      Called with the new value (or array for multiple)
 *  placeholder  {string}  Text shown when nothing is selected
 *  size         {string}  'sm' | 'md' | 'lg'  — trigger height/font
 *  variant      {string}  'default' | 'ghost'  — trigger border styling
 *  searchable   {bool}    Show a search input inside the menu
 *  clearable    {bool}    Show an × button to clear the selection
 *  multiple     {bool}    Multi-select mode (value is an array)
 *  disabled     {bool}
 *  icon         {Lucide}  Optional icon shown left of the trigger label
 *  label        {string}  Optional label rendered above the trigger
 *  error        {string}  Optional error text rendered below the trigger
 *  className    {string}  Extra classes on the outer wrapper
 *  menuClassName {string} Extra classes on the dropdown menu panel
 *  id           {string}  HTML id for the trigger button (for form labels)
 */
export const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  variant = 'default',
  searchable = false,
  clearable = false,
  multiple = false,
  disabled = false,
  icon: LeadIcon = null,
  label = '',
  error = '',
  className = '',
  menuClassName = '',
  id,
  placement = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // ─── Normalise value ────────────────────────────────────────────────────────
  const selectedValues = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value : value != null ? [value] : [];
    return value != null ? [value] : [];
  }, [value, multiple]);

  // ─── Filtered options ────────────────────────────────────────────────────────
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, search]);

  // ─── Derived display label ───────────────────────────────────────────────────
  const displayLabel = useMemo(() => {
    if (selectedValues.length === 0) return null;
    if (multiple) {
      if (selectedValues.length === 1) {
        const match = options.find((o) => o.value === selectedValues[0]);
        return match ? match.label : selectedValues[0];
      }
      return `${selectedValues.length} selected`;
    }
    const match = options.find((o) => o.value === selectedValues[0]);
    return match ? match.label : selectedValues[0];
  }, [selectedValues, options, multiple]);

  // ─── Open / close ────────────────────────────────────────────────────────────
  const openMenu = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    setFocusedIdx(-1);
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearch('');
    setFocusedIdx(-1);
  }, []);

  const toggleMenu = useCallback(() => {
    open ? closeMenu() : openMenu();
  }, [open, openMenu, closeMenu]);

  // ─── Outside click ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeMenu]);

  // Focus search when menu opens
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIdx]);

  // ─── Select logic ────────────────────────────────────────────────────────────
  const selectOption = useCallback((optValue) => {
    if (multiple) {
      const next = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue];
      onChange?.(next);
      // Keep menu open for multi
    } else {
      onChange?.(optValue);
      closeMenu();
    }
  }, [multiple, selectedValues, onChange, closeMenu]);

  const clearSelection = useCallback((e) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : null);
  }, [multiple, onChange]);

  // ─── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    const enabledOptions = filteredOptions.filter((o) => !o.disabled);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          openMenu();
        } else if (focusedIdx >= 0 && enabledOptions[focusedIdx]) {
          selectOption(enabledOptions[focusedIdx].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openMenu(); break; }
        setFocusedIdx((prev) => Math.min(prev + 1, enabledOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Tab':
        if (open) closeMenu();
        break;
      default:
        break;
    }
  }, [disabled, filteredOptions, open, focusedIdx, openMenu, closeMenu, selectOption]);

  // ─── Size variants ────────────────────────────────────────────────────────────
  const sizeMap = {
    sm:  { trigger: 'h-8  text-xs  px-2.5 gap-1.5', menu: 'text-xs',  icon: 14 },
    md:  { trigger: 'h-10 text-sm  px-3   gap-2',   menu: 'text-sm',  icon: 16 },
    lg:  { trigger: 'h-12 text-base px-4  gap-2.5', menu: 'text-base', icon: 18 },
  };
  const sz = sizeMap[size] || sizeMap.md;

  // ─── Trigger border styling ───────────────────────────────────────────────────
  const variantMap = {
    default: `bg-white border ${error ? 'border-status-danger' : open ? 'border-brand-primary ring-2 ring-brand-primary/10' : 'border-border-color hover:border-gray-400'} rounded-card`,
    ghost:   `bg-transparent border-0 hover:bg-gray-50 rounded-card`,
  };

  return (
    <div ref={wrapperRef} className={`relative flex flex-col gap-1 ${className}`}>

      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        className={`
          w-full flex items-center justify-between
          ${sz.trigger}
          ${variantMap[variant] || variantMap.default}
          transition-all duration-150
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          cursor-pointer select-none
        `}
      >
        {/* Left: lead icon + label */}
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {LeadIcon && <LeadIcon size={sz.icon} className="text-gray-400 shrink-0" />}
          <span className={`truncate font-medium ${displayLabel ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
            {displayLabel ?? placeholder}
          </span>
        </span>

        {/* Right: clear + chevron */}
        <span className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && selectedValues.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={clearSelection}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={sz.icon - 2} />
            </span>
          )}
          <ChevronDown
            size={sz.icon}
            className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Error text */}
      {error && (
        <p className="text-xs font-semibold text-status-danger mt-0.5">{error}</p>
      )}

      {/* ── Dropdown menu ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable={multiple}
          className={`
            absolute z-50 right-0
            ${placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1.5'}
            bg-white border border-card-border shadow-xl
            p-1 flex flex-col
            ${menuClassName}
          `}
          style={{ minWidth: '140px' }}
        >
          {/* Search input */}
          {searchable && (
            <div className="px-2 pt-2 pb-1 border-b border-border-color/50">
              <div className="flex items-center gap-2 bg-app-bg rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-gray-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIdx(-1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search…"
                  className="flex-1 bg-transparent text-xs text-[#1A1A1A] placeholder:text-gray-400 focus:outline-none min-w-0"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            className="overflow-y-auto max-h-60 flex flex-col gap-0.5"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center select-none">
                No options found
              </li>
            ) : (
              (() => {
                let groupRendered = {};
                let enabledIdx = -1;
                return filteredOptions.map((opt, idx) => {
                  if (!opt.disabled) enabledIdx++;
                  const currentEnabledIdx = enabledIdx;
                  const isSelected = selectedValues.includes(opt.value);
                  const isFocused = currentEnabledIdx === focusedIdx;
                  const OptIcon = opt.icon;

                  // Group header
                  const groupHeader = opt.group && !groupRendered[opt.group]
                    ? (() => { groupRendered[opt.group] = true; return opt.group; })()
                    : null;

                  return (
                    <React.Fragment key={opt.value ?? idx}>
                      {groupHeader && (
                        <li className="px-3 py-1 mt-1 text-xs-portal font-bold text-gray-400 uppercase tracking-wider select-none">
                          {groupHeader}
                        </li>
                      )}
                      <li
                        data-option
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled}
                        onClick={() => !opt.disabled && selectOption(opt.value)}
                        onMouseEnter={() => !opt.disabled && setFocusedIdx(currentEnabledIdx)}
                        className={`
                          flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition-colors duration-75 select-none
                          ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                          ${isSelected ? 'bg-status-info text-white font-semibold' : ''}
                          ${isFocused && !isSelected && !opt.disabled ? 'bg-gray-50 text-[#1A1A1A]' : ''}
                          ${!isSelected && !isFocused ? 'text-[#1A1A1A]' : ''}
                        `}
                      >
                        {/* Left icon */}
                        {OptIcon && <OptIcon size={14} className="shrink-0" />}

                        {/* Label */}
                        <span className={`flex-1 text-sm font-medium truncate`}>
                          {opt.label}
                        </span>

                        {/* Check mark for selected */}
                        {isSelected && (
                          <Check size={14} className="shrink-0 text-white" />
                        )}
                      </li>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </ul>

          {/* Multi-select footer */}
          {multiple && selectedValues.length > 0 && (
            <div className="border-t border-border-color/50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-semibold">
                {selectedValues.length} selected
              </span>
              <button
                onClick={() => onChange?.([])}
                className="text-xs font-bold text-status-danger hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
