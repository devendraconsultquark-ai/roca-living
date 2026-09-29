import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

// "⋯" menu for a table row. items: [{ label, icon, onClick, danger }].
// The list is drawn in a portal with a fixed position, so the table's
// horizontal scroll container can't clip it on the last rows.
export const RowActionsMenu = ({ items = [], label = 'More actions' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter(Boolean);

  const place = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const menuHeight = menuRef.current?.offsetHeight || 0;
    const below = r.bottom + 4;
    // Open upwards when there's no room below.
    const top = menuHeight && below + menuHeight > window.innerHeight - 8 ? r.top - menuHeight - 4 : below;
    setPos({ top, right: window.innerWidth - r.right });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); buttonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-8 h-8 inline-flex items-center justify-center rounded-card text-ink-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-status-info/30"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos?.top ?? -9999, right: pos?.right ?? 0, zIndex: 60 }}
          className="min-w-[180px] py-1 bg-white border border-card-border rounded-card shadow-premium"
        >
          {visible.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick?.(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs-portal font-semibold cursor-pointer focus:outline-none transition-colors ${
                  item.danger
                    ? 'text-status-danger hover:bg-status-danger-bg focus:bg-status-danger-bg'
                    : 'text-ink hover:bg-gray-50 focus:bg-gray-50'
                }`}
              >
                {Icon && <Icon size={14} className="shrink-0" />}
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};
