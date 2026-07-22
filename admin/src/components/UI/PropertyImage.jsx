import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { getPropertyImageUrl } from '../../utilities/propertyImageCache';

// Photo tile that falls back to the standard icon square while loading, on
// error, or when the property has no photo (imageId null/undefined).
export const PropertyThumb = ({ imageId, alt = '', className = '', iconSize = 20 }) => {
  const [loaded, setLoaded] = useState({ id: null, url: null });

  useEffect(() => {
    if (!imageId) return undefined;
    let cancelled = false;
    getPropertyImageUrl(imageId)
      .then((objectUrl) => {
        if (!cancelled) setLoaded({ id: imageId, url: objectUrl });
      })
      .catch(() => {}); // fallback tile stays
    return () => { cancelled = true; };
  }, [imageId]);

  const url = loaded.id === imageId ? loaded.url : null;

  if (!url) {
    return (
      <div className={`bg-surface-hover flex items-center justify-center text-brand-primary ${className}`}>
        <Home size={iconSize} />
      </div>
    );
  }
  return <img src={url} alt={alt} className={`object-cover ${className}`} />;
};
