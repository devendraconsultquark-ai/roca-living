import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { useFloating } from './useFloating';

// A small ⓘ next to a label or title; its short explanation shows on hover,
// keyboard focus or tap, floating on top of the page (never cut off by a popup).
// Keep the text to a sentence or two.
export const InfoTip = ({ text, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { floatRef, style } = useFloating(ref, open, { prefer: 'above', center: true });

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!text) return null;
  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label="More information"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex text-gray-400 hover:text-brand-accent focus:text-brand-accent cursor-pointer focus:outline-none"
      >
        <Info size={13} />
      </button>
      {open && createPortal(
        <span
          ref={floatRef}
          role="tooltip"
          style={style}
          className="w-60 rounded-lg bg-brand-primary text-white text-xs font-medium leading-snug normal-case px-3 py-2 shadow-xl pointer-events-none"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
};
