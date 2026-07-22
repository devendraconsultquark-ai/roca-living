import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Map, Star, Trash2, Upload } from 'lucide-react';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { Card } from './DetailComponents';
import { Button } from './Button';
import { getPropertyImageUrl, evictPropertyImageUrl } from '../../utilities/propertyImageCache';
import api from '../../utilities/api';

// Photos & floor plans tab for a property (spec pages 5–13). Files are served
// through the authenticated /properties/images endpoint, so each tile resolves
// a blob object-URL via the shared module cache.
export const PropertyPhotos = ({ propertyId, onChanged }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [images, setImages] = useState([]); // [{...img, url}]
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fileInputRef = useRef(null);
  const pendingTypeRef = useRef('photo'); // which button opened the picker

  useEffect(() => {
    let cancelled = false;
    const fetchImages = async () => {
      try {
        const res = await api.get(`/properties/${propertyId}/images`);
        const list = res.data?.data || [];
        const withUrls = await Promise.all(
          list.map(async (img) => {
            try {
              const url = await getPropertyImageUrl(img.id);
              return { ...img, url };
            } catch {
              return { ...img, url: null };
            }
          })
        );
        if (!cancelled) setImages(withUrls);
      } catch (err) {
        if (!cancelled) addToast(err.response?.data?.message || 'Failed to load photos', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchImages();
    return () => { cancelled = true; };
  }, [propertyId, reloadKey, addToast]);

  const openPicker = (type) => {
    pendingTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const imageType = pendingTypeRef.current;

    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('image_type', imageType);
      try {
        await api.post(`/properties/${propertyId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploaded += 1;
      } catch (err) {
        addToast(err.response?.data?.message || `Failed to upload ${file.name}`, 'error');
      }
    }
    setUploading(false);
    if (uploaded > 0) {
      addToast(`${uploaded} ${imageType === 'floor_plan' ? 'floor plan' : 'photo'}${uploaded > 1 ? 's' : ''} uploaded`, 'success');
      setReloadKey((k) => k + 1);
      onChanged?.();
    }
  };

  const handleSetPrimary = async (img) => {
    try {
      await api.patch(`/properties/${propertyId}/images/${img.id}`, { is_primary: true });
      addToast('Primary photo updated', 'success');
      setReloadKey((k) => k + 1);
      onChanged?.();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update photo', 'error');
    }
  };

  const handleDelete = async (img) => {
    const ok = await confirm({
      title: `Delete ${img.image_type === 'floor_plan' ? 'Floor Plan' : 'Photo'}`,
      message: 'The image file will be permanently removed. This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete'
    });
    if (!ok) return;
    try {
      await api.delete(`/properties/${propertyId}/images/${img.id}`);
      evictPropertyImageUrl(img.id);
      addToast('Image deleted', 'success');
      setReloadKey((k) => k + 1);
      onChanged?.();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete image', 'error');
    }
  };

  const photos = images.filter((i) => i.image_type === 'photo');
  const floorPlans = images.filter((i) => i.image_type === 'floor_plan');

  const tile = (img, isPhoto) => (
    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-card-border bg-surface-light">
      {img.url ? (
        <a href={img.url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={img.url} alt={img.caption || (isPhoto ? 'Property photo' : 'Floor plan')} className="w-full h-40 object-cover" />
        </a>
      ) : (
        <div className="w-full h-40 flex items-center justify-center text-gray-300">
          <ImageIcon size={28} />
        </div>
      )}
      {isPhoto && img.is_primary && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-brand-accent text-white text-2xs font-bold px-2 py-0.5 rounded-sm shadow-sm">
          <Star size={11} /> Primary
        </span>
      )}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isPhoto && !img.is_primary && (
          <button
            onClick={() => handleSetPrimary(img)}
            className="p-1.5 bg-white/90 text-brand-primary hover:text-brand-accent rounded-lg shadow-sm cursor-pointer"
            title="Set as primary photo"
          >
            <Star size={14} />
          </button>
        )}
        <button
          onClick={() => handleDelete(img)}
          className="p-1.5 bg-white/90 text-brand-primary hover:text-status-danger rounded-lg shadow-sm cursor-pointer"
          title="Delete image"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      <Card title={`Photos${photos.length > 0 ? ` (${photos.length})` : ''}`}>
        <div className="flex justify-end mb-4">
          <Button variant="primary" icon={Upload} onClick={() => openPicker('photo')} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Add Photos'}
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-hover animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((img) => tile(img, true))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
            <ImageIcon size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-status-muted">No photos yet</p>
            <p className="text-xs text-gray-400 mt-1">The first photo you add becomes the card thumbnail.</p>
          </div>
        )}
      </Card>

      <Card title={`Floor Plans${floorPlans.length > 0 ? ` (${floorPlans.length})` : ''}`}>
        <div className="flex justify-end mb-4">
          <Button variant="secondary" icon={Map} onClick={() => openPicker('floor_plan')} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Add Floor Plan'}
          </Button>
        </div>
        {!loading && floorPlans.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {floorPlans.map((img) => tile(img, false))}
          </div>
        ) : !loading ? (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-light rounded-card border border-dashed border-card-border">
            <Map size={28} className="text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-status-muted">No floor plans uploaded</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
