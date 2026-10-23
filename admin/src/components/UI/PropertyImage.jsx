import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { getPropertyImageUrl } from '../../utilities/propertyImageCache';

// Generic apartment pictures (from the client design) shown when a flat has no
// photo of its own. Each flat always gets the same one (picked from
// `fallbackKey`, e.g. its unit number), and a real photo replaces it.
const DEFAULT_PICTURES = [1, 2, 3, 4].map((n) => `${import.meta.env.BASE_URL}images/apartment-defaults/apartment-${n}.jpg`);
const defaultPicture = (key) => {
  const s = String(key);
  const n = /^\d+$/.test(s) ? Number(s) : [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  // Multiplicative hash (top bits), so neighbouring units and the managed few
  // get different pictures instead of repeating every 4th unit.
  const spread = (Math.imul(n, 2654435761) >>> 0) / 2 ** 32;
  return DEFAULT_PICTURES[Math.floor(spread * DEFAULT_PICTURES.length)];
};

// Photo tile that falls back to the standard icon square while loading, on
// error, or when the property has no photo (imageId null/undefined). With a
// `fallbackKey`, a generic apartment picture tagged "Sample photo" is shown
// instead of the icon (not while the real photo is still loading).
export const PropertyThumb = ({ imageId, alt = '', className = '', iconSize = 20, fallbackKey }) => {
  const [loaded, setLoaded] = useState({ id: null, url: null, failed: false });

  useEffect(() => {
    if (!imageId) return undefined;
    let cancelled = false;
    getPropertyImageUrl(imageId)
      .then((objectUrl) => {
        if (!cancelled) setLoaded({ id: imageId, url: objectUrl, failed: false });
      })
      .catch(() => { if (!cancelled) setLoaded({ id: imageId, url: null, failed: true }); });
    return () => { cancelled = true; };
  }, [imageId]);

  const url = loaded.id === imageId ? loaded.url : null;
  const stillLoading = !!imageId && loaded.id !== imageId;

  if (!url && fallbackKey !== undefined && fallbackKey !== null && !stillLoading) {
    return (
      <div className={`relative overflow-hidden bg-surface-hover ${className}`}>
        <img src={defaultPicture(fallbackKey)} alt={alt ? `${alt} (sample photo)` : 'Sample photo'} className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/55 text-white text-[10px] font-semibold leading-none">
          Sample photo
        </span>
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`bg-surface-hover flex items-center justify-center text-brand-primary ${className}`}>
        <Home size={iconSize} />
      </div>
    );
  }
  return <img src={url} alt={alt} className={`object-cover ${className}`} />;
};
