import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, FileText, Upload, Trash2, CheckCircle2, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const DocumentLibrary = () => {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('f1');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const { addToast } = useToast();

  // Upload Form State
  const [scope, setScope] = useState('');
  const [entityId, setEntityId] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const fetchFolders = async () => {
    try {
      const response = await api.get('/documents/folders', { skipInterceptorError: true });
      if (response.data?.data) {
        setFolders(response.data.data);
      }
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to load document folders', 'error');
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleToggleFolder = (folderId) => {
    setFolders(prev =>
      prev.map(f => (f.id === folderId ? { ...f, isOpen: !f.isOpen } : f))
    );
  };

  const handleSelectFolder = (folderId) => {
    setSelectedFolderId(folderId);
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile({
        name: file.name,
        size: formatBytes(file.size),
        raw: file,
      });
      addToast(`File "${file.name}" ready for upload`, 'info');
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile({
        name: file.name,
        size: formatBytes(file.size),
        raw: file,
      });
      addToast(`File "${file.name}" ready for upload`, 'info');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!uploadedFile) {
      errors.file = 'Please drag or select a file to upload';
    }
    if (!scope) {
      errors.scope = 'Please select a document scope';
    }
    if (!entityId.trim()) {
      errors.entityId = 'Please enter a linked Entity ID';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      addToast('Please complete all required fields', 'warning');
      return;
    }

    setFormErrors({});

    const formDataPayload = new FormData();
    if (uploadedFile.raw) {
      formDataPayload.append('file', uploadedFile.raw);
    }
    formDataPayload.append('scope', scope);
    formDataPayload.append('entityId', entityId);

    try {
      await api.post('/documents/upload', formDataPayload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      addToast('Document uploaded successfully!', 'success');
      await fetchFolders();
      // Reset only on success so a failed upload can be retried as-is.
      setUploadedFile(null);
      setScope('');
      setEntityId('');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to upload ${uploadedFile.name}`, 'error');
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/documents/${fileId}`);
      addToast('Document deleted successfully', 'success');
      await fetchFolders();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to delete document', 'error');
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await api.get(`/documents/${file.id}/download`, {
        responseType: 'blob',
        skipInterceptorError: true
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name || `document-${file.id}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let msg = 'Failed to download document';
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* keep default */ }
      } else {
        msg = err.response?.data?.message || msg;
      }
      addToast(msg, 'error');
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  return (
    <div className="py-6 max-w-7xl mx-auto px-4">
      {/* Title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Documents Library</h2>
        <p className="text-sm text-gray-500 mt-1">Manage compliance certificates, signed tenancy agreements, and landlord utility documents.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Pane: Folder Tree */}
        <div className="lg:col-span-1 bg-white border border-border-color rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2 select-none">Folder Tree</h3>
          
          <div className="flex flex-col gap-2">
            {folders.map(folder => {
              const isSelected = folder.id === selectedFolderId;
              return (
                <div key={folder.id} className="flex flex-col">
                  {/* Folder Item */}
                  <div 
                    onClick={() => handleSelectFolder(folder.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-brand-accent/10 text-brand-accent font-semibold border-l-4 border-brand-accent' 
                        : 'hover:bg-app-bg text-[#1A1A1A]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFolder(folder.id);
                        }}
                        className="p-1 hover:bg-black/5 rounded text-gray-400 focus:outline-none"
                      >
                        {folder.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {folder.isOpen ? (
                        <FolderOpen size={18} className="text-brand-accent shrink-0" />
                      ) : (
                        <Folder size={18} className="text-brand-accent shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm truncate select-none">{folder.name}</span>
                    </div>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full border text-gray-500 font-bold">
                      {folder.children.length}
                    </span>
                  </div>

                  {/* Folder Children Files (if expanded) */}
                  {folder.isOpen && (
                    <div className="ml-8 mt-1.5 flex flex-col gap-1 border-l border-border-color pl-3">
                      {folder.children.map(file => (
                        <div 
                          key={file.id} 
                          className="flex items-center gap-2 py-1.5 text-xs text-gray-500 hover:text-[#1A1A1A]"
                        >
                          <FileText size={14} className="text-status-muted shrink-0" />
                          <span className="truncate select-none">{file.name}</span>
                        </div>
                      ))}
                      {folder.children.length === 0 && (
                        <span className="text-[10px] text-gray-400 italic py-1 pl-1">Empty folder</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Files inside Selected Folder & Upload Form */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Active Folder Files Grid */}
          <div className="bg-white border border-border-color rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-brand-primary/5 border-b border-border-color p-5">
              <h3 className="font-bold text-base text-[#1A1A1A] flex items-center gap-2 select-none">
                <FolderOpen size={18} className="text-brand-accent" />
                Contents of: <span className="text-brand-accent">{selectedFolder?.name}</span>
              </h3>
            </div>

            <div className="p-6">
              <div className="flex flex-col gap-3">
                {selectedFolder?.children.map(file => (
                  <div 
                    key={file.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-app-bg/50 border border-border-color rounded-xl hover:bg-app-bg transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="bg-white p-2 rounded-lg border border-border-color text-brand-accent shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate">{file.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 font-semibold mt-1">
                          {file.doc_reference && (
                            <>
                              <span className="text-gray-600 font-bold bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{file.doc_reference}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>Size: {file.size}</span>
                          <span>•</span>
                          <span>Uploaded: {file.date}</span>
                          <span>•</span>
                          <span className="capitalize text-brand-accent">Scope: {file.scope} ({file.entityId})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <button
                        onClick={() => handleDownloadFile(file)}
                        className="p-2 text-gray-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors border border-transparent hover:border-brand-accent/10 cursor-pointer"
                        title="Download document"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 text-gray-400 hover:text-status-danger hover:bg-status-danger/5 rounded-lg transition-colors border border-transparent hover:border-status-danger/10 cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedFolder?.children.length === 0 && (
                  <div className="text-center py-12 text-sm text-gray-400 font-medium">
                    No documents found in this directory. Upload a new file below.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload Form Box */}
          <div className="bg-white border border-border-color rounded-2xl shadow-sm">
            <div className="bg-brand-primary/5 border-b border-border-color p-5 rounded-t-2xl">
              <h3 className="font-bold text-base text-[#1A1A1A] flex items-center gap-2 select-none">
                <Upload size={18} className="text-brand-accent" />
                Upload New Certificate / Document
              </h3>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 md:p-8 flex flex-col gap-6">
              
              {/* Drag and Drop Zone */}
              <div className="flex flex-col w-full">
                <span className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-0.5 select-none">
                  Select File <span className="text-status-danger">*</span>
                </span>
                
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[160px] relative ${
                    dragActive 
                      ? 'border-brand-accent bg-brand-accent/5 ring-4 ring-brand-accent/10' 
                      : uploadedFile 
                        ? 'border-status-success bg-status-success/5 animate-pulse' 
                        : 'border-border-color hover:border-brand-accent bg-white'
                  }`}
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    onChange={handleFileInputChange}
                  />
                  
                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-status-success/15 flex items-center justify-center text-status-success">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">{uploadedFile.name}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-1">Size: {uploadedFile.size} • Ready for upload</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setUploadedFile(null);
                        }}
                        className="text-[10px] text-status-danger hover:underline font-bold z-30 cursor-pointer"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
                        <Upload size={20} />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-[#1A1A1A]">
                        Drag and drop files here, or <span className="text-brand-accent hover:underline">browse</span>
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold">Supports PDF, PNG, JPG, DOCX (Max 10MB)</p>
                    </div>
                  )}
                </div>
                {formErrors.file && (
                  <span className="text-xs text-status-danger mt-1 font-semibold" role="alert">
                    {formErrors.file}
                  </span>
                )}
              </div>

              {/* Form Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Dropdown
                  label="Document Scope"
                  id="scope"
                  placeholder="Select scope"
                  value={scope}
                  error={formErrors.scope}
                  onChange={(val) => {
                    setScope(val);
                    if (formErrors.scope) setFormErrors(prev => ({ ...prev, scope: '' }));
                  }}
                  options={[
                    { value: 'landlord', label: 'Landlord Level' },
                    { value: 'property', label: 'Property Level' },
                  ]}
                />
                
                <Input
                  label="Linked Entity ID"
                  id="entityId"
                  required
                  placeholder="e.g. LND-9018 or PRP-1020"
                  value={entityId}
                  error={formErrors.entityId}
                  onChange={(e) => {
                    setEntityId(e.target.value);
                    if (formErrors.entityId) setFormErrors(prev => ({ ...prev, entityId: '' }));
                  }}
                />
              </div>

              {/* Action Button */}
              <Button 
                type="submit"
                variant="primary"
                fullWidth
                className="mt-2"
              >
                Upload Document
              </Button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
