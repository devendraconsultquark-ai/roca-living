import { useEffect, useRef, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { Button } from './Button';
import api from '../../utilities/api';

// Look at a document without downloading it: PDFs and text in the browser's
// viewer, images as they are; other types (Word, Excel) offer Download.
// doc: { id, name } — null keeps the popup closed. onDownload(doc) is the page's
// own download handler.
export const DocumentPreviewModal = ({ doc, onClose, onDownload }) => {
  // What was loaded, for which document: { id, url, type } or { id, error }.
  const [loaded, setLoaded] = useState({ id: null });
  // Pages pass a new onClose each render; Escape uses the latest without refetching.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!doc) return undefined;
    let url = null;
    let cancelled = false;
    api.get(`/documents/${doc.id}/download`, { responseType: 'blob', skipInterceptorError: true })
      .then((res) => {
        if (cancelled) return;
        const type = String(res.headers?.['content-type'] || res.data.type || '').split(';')[0];
        url = URL.createObjectURL(new Blob([res.data], { type }));
        setLoaded({ id: doc.id, url, type });
      })
      .catch(async (err) => {
        if (cancelled) return;
        let msg = 'Could not open this document';
        if (err.response?.data instanceof Blob) {
          try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* keep default */ }
        }
        setLoaded({ id: doc.id, error: msg });
      });
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);

  if (!doc) return null;
  const current = loaded.id === doc.id ? loaded : {};
  const file = current.url ? current : null;
  const error = current.error || null;
  const isPdf = file?.type === 'application/pdf';
  const isImage = file?.type.startsWith('image/');
  const isText = file?.type === 'text/plain';

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl border border-card-border w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" role="dialog" aria-label={`Preview ${doc.name}`}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-card-border shrink-0">
          <FileText size={18} className="text-brand-accent shrink-0" />
          <h3 className="text-sm font-bold text-brand-primary truncate flex-1" title={doc.name}>{doc.name}</h3>
          <Button variant="secondary" size="sm" icon={Download} onClick={() => onDownload(doc)}>Download</Button>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close preview">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-surface-light flex items-center justify-center">
          {error ? (
            <p className="text-sm text-status-danger font-semibold px-6 text-center">{error}</p>
          ) : !file ? (
            <p className="text-sm text-status-muted">Loading…</p>
          ) : isPdf || isText ? (
            <iframe src={file.url} title={doc.name} className="w-full h-full border-0 bg-white" />
          ) : isImage ? (
            <img src={file.url} alt={doc.name} className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p className="text-sm text-status-muted">This type of file can't be shown here. Download it to open it.</p>
              <Button variant="primary" size="sm" icon={Download} onClick={() => onDownload(doc)}>Download</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
