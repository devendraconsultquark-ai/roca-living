import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useToast } from './ToastContext';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import api from '../../utilities/api';

const DEFAULT_FOLDER_BY_SCOPE = {
  landlord: 'Landlord Compliance Documents',
  property: 'Property Gas & Safety Certs',
  tenancy: 'Tenancy Agreements & Deposits',
};

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Pre-upload review dialog shared by the detail pages: shows what was picked
// (with an image preview when possible) and lets the admin choose the folder
// before anything is sent. Nothing uploads until "Upload" is clicked.
export const DocumentUploadModal = ({ file, scope, entityId, onClose, onUploaded }) => {
  const { addToast } = useToast();
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState('');
  const [uploading, setUploading] = useState(false);

  const previewUrl = useMemo(
    () => (file && file.type?.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!file) return;
    const fetchFolders = async () => {
      try {
        const res = await api.get('/documents/folders');
        const list = (res.data?.data || []).map((f) => ({ id: f.id, name: f.name }));
        setFolders(list);
        const defaultName = DEFAULT_FOLDER_BY_SCOPE[scope];
        const preselected = list.find((f) => f.name === defaultName) || list[0];
        if (preselected) setFolderId(String(preselected.id));
      } catch (err) {
        console.error(err);
        addToast(err.response?.data?.message || 'Failed to load document folders', 'error');
      }
    };
    fetchFolders();
  }, [file, scope, addToast]);

  if (!file) return null;

  const handleUpload = async () => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', scope);
    formData.append('entityId', String(entityId));
    if (folderId) formData.append('folderId', folderId);
    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('Document uploaded successfully!', 'success');
      onUploaded();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to upload ${file.name}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
        <h3 className="text-lg font-bold text-brand-primary mb-4">Upload Document</h3>

        <div className="flex items-center gap-4 p-4 bg-surface-light border border-card-border rounded-card">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="w-16 h-16 object-cover rounded-lg border border-card-border shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-white border border-card-border flex items-center justify-center text-brand-accent shrink-0">
              <FileText size={28} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-primary truncate">{file.name}</p>
            <p className="text-xs text-status-muted mt-0.5">
              {formatSize(file.size)}{file.type ? ` • ${file.type}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Dropdown
            label="Category (folder)"
            id="upload-folder"
            options={folders.map((f) => ({ value: String(f.id), label: f.name }))}
            value={folderId}
            onChange={(val) => setFolderId(val)}
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleUpload} disabled={uploading || !folderId}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
};
