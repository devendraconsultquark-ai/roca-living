import { useLayoutEffect, useRef, useState } from 'react';

// Place a menu, calendar or tooltip on top of everything (render it in a portal
// with this style), next to its field: below it, or above when there is more
// room above. It follows the field when a popup or the page scrolls, so it is
// never cut off by a popup's edge or hidden behind its footer.
//   anchorRef  the field (or icon) it belongs to
//   open       whether it is showing
//   options    minWidth: 'anchor' (at least as wide as the field) or a number;
//              width: 'anchor' (exactly as wide); prefer: 'below' | 'above';
//              center: centre it on the anchor (tooltips)
export const useFloating = (anchorRef, open, { minWidth = 0, width = null, prefer = 'below', center = false, gap = 6 } = {}) => {
  const floatRef = useRef(null);
  const [style, setStyle] = useState({ position: 'fixed', top: 0, left: 0, visibility: 'hidden', zIndex: 1000 });

  useLayoutEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const el = floatRef.current;
      if (!a || !el) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = width === 'anchor' ? a.width : el.offsetWidth;
      const h = el.offsetHeight;
      const below = vh - a.bottom - gap;
      const above = a.top - gap;
      const up = prefer === 'above' ? (above >= h || above > below) : (below < h && above > below);
      let top = up ? a.top - gap - h : a.bottom + gap;
      top = Math.max(8, Math.min(top, vh - h - 8));
      let left = center ? a.left + a.width / 2 - w / 2 : a.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      setStyle({
        position: 'fixed',
        top,
        left,
        zIndex: 1000,
        ...(width === 'anchor' ? { width: a.width } : {}),
        ...(minWidth === 'anchor' ? { minWidth: a.width } : minWidth ? { minWidth } : {}),
        maxWidth: vw - 16,
      });
    };
    place();
    frame = requestAnimationFrame(place); // again once the size is known
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef, minWidth, width, prefer, center, gap]);

  return { floatRef, style };
};
