import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ShieldCheck, Users, Wrench, FileText, Clock, Building2, MapPin, Hash, Receipt, Download, Upload
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { StatusPill } from '../components/UI/StatusPill';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs, CertBadge, urgencyColor } from '../components/UI/DetailComponents';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const PropertyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Certificate update modal
  const [certModalCert, setCertModalCert] = useState(null); // the cert being edited, or null
  const [certForm, setCertForm] = useState({ issued_at: '', expires_at: '', notes: '' });
  const [certFile, setCertFile] = useState(null);
  const [certSaving, setCertSaving] = useState(false);

  // Edit property modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    property_type: 'flat',
    bedrooms: '',
    rent_pcm: '',
    mgmt_fee_pct: '12.00',
    block_name: '',
    apartment_number: '',
    key_ref: '',
    notes: '',
    status: 'onboarding',
    name: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Documents tab
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [docsReloadKey, setDocsReloadKey] = useState(0);

  // Bump to re-fetch after a mutation (certificate update).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await api.get(`/properties/${id}`);
        setData(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load property', 'error');
        navigate('/properties');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id, navigate, addToast, reloadKey]);

  // Documents linked to this property — property-scoped docs plus tenancy-scoped
  // docs whose entity reference points at this property.
  const propertyRef = data?.property_reference || `PRP-${id}`;
  useEffect(() => {
    if (!data) return;
    const fetchDocuments = async () => {
      try {
        const res = await api.get('/documents/folders', { skipInterceptorError: true });
        const allDocs = (res.data?.data || []).flatMap((folder) => folder.children || []);
        setDocuments(allDocs.filter((d) =>
          (d.scope === 'property' && d.entityId === propertyRef) ||
          (d.scope === 'tenancy' && typeof d.entityId === 'string' && d.entityId.includes(`@ ${propertyRef}`))
        ));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load documents', 'error');
      }
    };
    fetchDocuments();
  }, [data, propertyRef, addToast, docsReloadKey]);

  const openEditModal = () => {
    setEditingProperty({
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      city: data.city || '',
      postcode: data.postcode || '',
      property_type: data.property_type || 'flat',
      bedrooms: data.bedrooms != null ? String(data.bedrooms) : '',
      rent_pcm: data.rent_pcm != null ? String(data.rent_pcm) : '',
      mgmt_fee_pct: data.mgmt_fee_pct != null ? String(data.mgmt_fee_pct) : '12.00',
      block_name: data.block_name || '',
      apartment_number: data.apartment_number || '',
      key_ref: data.key_ref || '',
      notes: data.notes || '',
      status: data.status || 'onboarding',
      name: data.name || ''
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.patch(`/properties/${id}`, editingProperty);
      addToast('Property updated successfully!', 'success');
      setIsEditModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((fieldErr) => {
          errorsObj[fieldErr.field] = fieldErr.message;
        });
        setFormErrors(errorsObj);
      } else {
        addToast(err.response?.data?.message || 'Failed to update property', 'error');
      }
    }
  };

  const handleDocDownload = async (file) => {
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

  const handleDocUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', 'property');
    formData.append('entityId', String(id));
    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast('Document uploaded successfully!', 'success');
      setDocsReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to upload document', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChecklistToggle = async (item) => {
    const newStatus = item.status === 'complete' ? 'pending' : 'complete';
    if (newStatus === 'complete') {
      const ok = await confirm({
        title: 'Mark Checklist Item Complete',
        message: `Confirm "${item.item_label}" has been verified. This counts towards the property's readiness to let.`,
        confirmText: 'Mark Complete',
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/properties/${id}/checklist/${item.item_code}`, { status: newStatus });
      addToast(`"${item.item_label}" marked ${newStatus}`, 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update checklist item', 'error');
    }
  };

  const openCertModal = (cert) => {
    setCertForm({
      issued_at: cert.issued_at || '',
      expires_at: cert.expires_at || '',
      notes: cert.notes || ''
    });
    setCertFile(null);
    setCertModalCert(cert);
  };

  const handleCertSubmit = async (e) => {
    e.preventDefault();
    if (!certForm.expires_at) {
      addToast('Expiry date is required — it determines the compliance status', 'warning');
      return;
    }
    setCertSaving(true);
    try {
      await api.patch(`/properties/${id}/certificates/${certModalCert.cert_type}`, {
        issued_at: certForm.issued_at || null,
        expires_at: certForm.expires_at,
        notes: certForm.notes || null
      });
      if (certFile) {
        const formData = new FormData();
        formData.append('file', certFile);
        await api.post(`/properties/${id}/certificates/${certModalCert.cert_type}/document`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      addToast(`${certModalCert.cert_type} certificate updated`, 'success');
      setCertModalCert(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update certificate', 'error');
    } finally {
      setCertSaving(false);
    }
  };

  const handleCertDownload = async (cert) => {
    try {
      const res = await api.get(`/properties/${id}/certificates/${cert.cert_type}/document`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: res.headers?.['content-type'] }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cert.cert_type}_certificate.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to download certificate document', 'error');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Property',
      message: `Are you sure you want to delete this property? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Property',
    });
    
    if (ok) {
      try {
        await api.delete(`/properties/${id}`);
        addToast('Property deleted successfully', 'success');
        navigate('/properties');
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete property', 'error');
      }
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'tenancy', label: 'Tenancy', icon: Users },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'safety', label: 'Safety & Compliance', icon: ShieldCheck },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  const address = `${data.address_line1}${data.address_line2 ? ', ' + data.address_line2 : ''}, ${data.city} ${data.postcode}`;

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/properties"
        backLabel="Back to Properties"
        title={data.name || data.address_line1}
        badge={<StatusPill status={data.status === 'let' ? 'active' : data.status === 'vacant' ? 'pending' : 'draft'} />}
        subtitle={`${data.property_reference} • ${address} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Property"
        onEdit={openEditModal}
        onDelete={handleDelete}
      />

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Property Summary">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={Building2} label="Property Type" value={data.property_type} />
                    <DataRow icon={Home} label="Bedrooms" value={data.bedrooms != null ? `${data.bedrooms} Bed` : null} />
                    <DataRow icon={MapPin} label="Full Address" value={address} />
                    <DataRow icon={Hash} label="Key Reference" value={data.key_ref} />
                  </div>
                  <div>
                    <DataRow icon={Receipt} label="Monthly Rent" value={data.rent_pcm ? `£${parseFloat(data.rent_pcm).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null} />
                    <DataRow icon={Receipt} label="Management Fee" value={data.mgmt_fee_pct ? `${data.mgmt_fee_pct}%` : null} />
                    <DataRow icon={Users} label="Landlord" value={data.landlord_name} />
                  </div>
                </div>
                {data.notes && (
                  <div className="mt-6 bg-surface-light rounded-card p-4 text-sm text-status-muted border border-card-border">
                    <p className="font-semibold text-brand-primary mb-1">Notes</p>
                    {data.notes}
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Quick Status">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-status-muted">Current Occupancy</span>
                    <span className="text-sm font-bold text-brand-primary">{data.status === 'let' ? 'Occupied' : 'Vacant'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-status-muted">Active Tickets</span>
                    <span className="text-sm font-bold text-brand-primary">{data.maintenance_tickets?.filter(t => t.status !== 'complete' && t.status !== 'cancelled').length || 0}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tenancy' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Active Tenancy">
                {data.active_tenancy ? (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                      <div>
                        <DataRow icon={Clock} label="Start Date" value={data.active_tenancy.start_date ? new Date(data.active_tenancy.start_date).toLocaleDateString('en-GB') : null} />
                        <DataRow icon={Clock} label="End Date" value={data.active_tenancy.end_date ? new Date(data.active_tenancy.end_date).toLocaleDateString('en-GB') : 'Periodic'} />
                      </div>
                      <div>
                        <DataRow icon={Receipt} label="Rent PCM" value={`£${parseFloat(data.active_tenancy.rent_pcm).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-brand-primary mb-3">Tenants</h4>
                      <div className="flex flex-col gap-2">
                        {data.active_tenancy.tenants?.map(t => (
                          <div key={t.id}
                            onClick={() => navigate(`/tenants/${t.id}`)}
                            className="flex items-center justify-between bg-gray-50 border border-card-border/30 rounded-xl px-4 py-3 cursor-pointer hover:border-brand-accent transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-brand-primary">
                                <Users size={14} />
                              </div>
                              <span className="text-sm font-bold text-brand-primary">{t.name}</span>
                            </div>
                            {t.is_lead_tenant && <span className="text-2xs uppercase tracking-wider font-bold bg-status-info-bg text-status-info border border-status-info/15 px-2 py-0.5 rounded-sm">Lead Tenant</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                    <Users size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No active tenancy</p>
                    <p className="text-xs text-gray-400 mt-1">This property is currently vacant.</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Recent Maintenance">
                <div className="flex flex-col gap-3">
                  {data.maintenance_tickets?.length > 0 ? data.maintenance_tickets.map(t => (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/50 border border-card-border rounded-xl p-4 gap-4 hover:border-brand-accent transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-status-muted">
                          <Wrench size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-brand-primary">{t.title}</p>
                          <p className="text-xs text-status-muted mt-0.5">Reported: {t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xs font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider ${urgencyColor[t.urgency] || urgencyColor.routine}`}>
                          {t.urgency}
                        </span>
                        <span className="text-2xs font-bold bg-surface-hover text-gray-400 border border-card-border px-2 py-0.5 rounded-sm uppercase tracking-wider">
                          {t.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                      <Wrench size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm font-semibold text-status-muted">No maintenance tickets</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Safety Certificates">
                <div className="grid grid-cols-1 gap-3">
                  {(data.property_certificates || []).map(cert => (
                    <div key={cert.id} className="flex items-center justify-between bg-white border border-card-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-status-muted">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-brand-primary">{cert.cert_type}</p>
                          {cert.expires_at ? (
                            <p className="text-xs font-semibold text-status-muted mt-0.5">Expires: {new Date(cert.expires_at).toLocaleDateString('en-GB')}</p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">No expiry date set</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CertBadge status={cert.status} />
                        {cert.document_path && (
                          <Button variant="ghost" size="sm" onClick={() => handleCertDownload(cert)}>
                            View
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openCertModal(cert)}>
                          Update
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(data.property_certificates || []).length === 0 && (
                     <p className="text-sm text-gray-400 italic">No safety certificates uploaded.</p>
                  )}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Compliance Checklist">
                <div className="flex flex-col gap-3">
                  {(data.compliance_checklist || []).map(item => (
                    <div key={item.id} className="flex items-center justify-between pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <span className="text-xs-portal font-semibold text-brand-primary">{item.item_label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border ${
                          item.status === 'complete'
                            ? 'bg-status-success-bg text-status-success border-status-success/15'
                            : 'bg-status-warning/10 text-status-warning border-status-warning/15'
                        }`}>
                          {item.status}
                        </span>
                        <button
                          onClick={() => handleChecklistToggle(item)}
                          className="text-2xs font-bold text-brand-accent hover:underline cursor-pointer"
                          title={item.status === 'complete' ? 'Reopen this item' : 'Mark this item complete'}
                        >
                          {item.status === 'complete' ? 'Reopen' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {(data.compliance_checklist || []).length === 0 && (
                    <p className="text-sm text-gray-400 italic">No checklist items.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Property Documents">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleDocUpload(e.target.files?.[0])}
                />
                {documents.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        icon={Upload}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading…' : 'Upload Document'}
                      </Button>
                    </div>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-surface-light/50 border border-card-border rounded-card hover:bg-surface-light transition-colors gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="card-bg p-2 rounded-lg border border-card-border text-brand-accent shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-brand-primary truncate">{doc.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-400 font-semibold mt-1">
                              <span>Uploaded: {doc.date}</span>
                              <span>•</span>
                              <span>Size: {doc.size}</span>
                              <span>•</span>
                              <span className="text-brand-accent">{doc.scope === 'property' ? 'Property' : 'Tenancy'}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDocDownload(doc)}
                          className="p-2 text-gray-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors border border-transparent hover:border-brand-accent/10 cursor-pointer self-end sm:self-center"
                          title="Download document"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                    <FileText size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No documents uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">Leases, floor plans, and instructions will appear here.</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploading ? 'Uploading…' : 'Upload Document'}
                    </button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Property Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Edit Property Details</h3>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Property Name (Optional)"
                id="edit_name"
                placeholder="e.g. Parsons House"
                value={editingProperty.name}
                onChange={(e) => setEditingProperty({ ...editingProperty, name: e.target.value })}
                error={formErrors.name}
              />
              <Input
                label="Address Line 1"
                id="edit_address_line1"
                required
                value={editingProperty.address_line1}
                onChange={(e) => setEditingProperty({ ...editingProperty, address_line1: e.target.value })}
                error={formErrors.address_line1}
              />
              <Input
                label="Address Line 2"
                id="edit_address_line2"
                value={editingProperty.address_line2}
                onChange={(e) => setEditingProperty({ ...editingProperty, address_line2: e.target.value })}
                error={formErrors.address_line2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  id="edit_city"
                  required
                  value={editingProperty.city}
                  onChange={(e) => setEditingProperty({ ...editingProperty, city: e.target.value })}
                  error={formErrors.city}
                />
                <Input
                  label="Postcode"
                  id="edit_postcode"
                  required
                  value={editingProperty.postcode}
                  onChange={(e) => setEditingProperty({ ...editingProperty, postcode: e.target.value })}
                  error={formErrors.postcode}
                />
              </div>
              <Dropdown
                label="Property Type"
                id="edit_property_type"
                placeholder="Select type..."
                value={editingProperty.property_type}
                onChange={(val) => {
                  setEditingProperty(prev => ({ ...prev, property_type: val }));
                  if (formErrors.property_type) setFormErrors(prev => ({ ...prev, property_type: '' }));
                }}
                error={formErrors.property_type}
                options={[
                  { value: 'flat', label: 'Flat' },
                  { value: 'house', label: 'House' },
                  { value: 'HMO', label: 'HMO' }
                ]}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Bedrooms"
                  id="edit_bedrooms"
                  type="number"
                  value={editingProperty.bedrooms}
                  onChange={(e) => setEditingProperty({ ...editingProperty, bedrooms: e.target.value })}
                  error={formErrors.bedrooms}
                />
                <Input
                  label="Monthly Rent"
                  id="edit_rent_pcm"
                  type="number"
                  placeholder="£"
                  value={editingProperty.rent_pcm}
                  onChange={(e) => setEditingProperty({ ...editingProperty, rent_pcm: e.target.value })}
                  error={formErrors.rent_pcm}
                />
                <Input
                  label="Mgmt Fee %"
                  id="edit_mgmt_fee_pct"
                  type="number"
                  step="0.01"
                  placeholder="%"
                  value={editingProperty.mgmt_fee_pct}
                  onChange={(e) => setEditingProperty({ ...editingProperty, mgmt_fee_pct: e.target.value })}
                  error={formErrors.mgmt_fee_pct}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Block Name (statements)"
                  id="edit_block_name"
                  placeholder="e.g. PH"
                  value={editingProperty.block_name}
                  onChange={(e) => setEditingProperty({ ...editingProperty, block_name: e.target.value })}
                  error={formErrors.block_name}
                />
                <Input
                  label="Apartment Number"
                  id="edit_apartment_number"
                  placeholder="e.g. 12"
                  value={editingProperty.apartment_number}
                  onChange={(e) => setEditingProperty({ ...editingProperty, apartment_number: e.target.value })}
                  error={formErrors.apartment_number}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Key Reference"
                  id="edit_key_ref"
                  placeholder="e.g. KEY-PH-012"
                  value={editingProperty.key_ref}
                  onChange={(e) => setEditingProperty({ ...editingProperty, key_ref: e.target.value })}
                  error={formErrors.key_ref}
                />
                <Input
                  label="Notes"
                  id="edit_notes"
                  placeholder="Internal notes"
                  value={editingProperty.notes}
                  onChange={(e) => setEditingProperty({ ...editingProperty, notes: e.target.value })}
                  error={formErrors.notes}
                />
              </div>

              <Dropdown
                label="Property Status"
                id="edit_status"
                placeholder="Select status..."
                value={editingProperty.status}
                onChange={(val) => {
                  setEditingProperty(prev => ({ ...prev, status: val }));
                  if (formErrors.status) setFormErrors(prev => ({ ...prev, status: '' }));
                }}
                error={formErrors.status}
                options={[
                  { value: 'onboarding', label: 'Onboarding' },
                  { value: 'vacant', label: 'Vacant' },
                  { value: 'let', label: 'Let' }
                ]}
              />

              <div className="flex gap-3 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setFormErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Certificate Modal */}
      {certModalCert && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <h3 className="text-lg font-bold text-brand-primary mb-1">Update {certModalCert.cert_type} Certificate</h3>
            <p className="text-xs text-status-muted mb-4">The compliance status (compliant / expiring soon / expired) is calculated from the expiry date, and the matching checklist item is marked complete.</p>

            <form onSubmit={handleCertSubmit} className="flex flex-col gap-4">
              <Input
                label="Issued Date"
                id="cert_issued_at"
                type="date"
                value={certForm.issued_at}
                onChange={(e) => setCertForm({ ...certForm, issued_at: e.target.value })}
              />
              <Input
                label="Expiry Date"
                id="cert_expires_at"
                type="date"
                required
                value={certForm.expires_at}
                onChange={(e) => setCertForm({ ...certForm, expires_at: e.target.value })}
              />
              <Input
                label="Notes (optional)"
                id="cert_notes"
                value={certForm.notes}
                onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="cert_file" className="text-xs font-semibold text-status-muted uppercase tracking-wide">
                  Certificate File (PDF / JPEG / PNG{certModalCert.document_path ? ' — replaces the current file' : ''})
                </label>
                <input
                  id="cert_file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="text-xs-portal text-status-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-card-border file:bg-surface-light file:text-brand-primary file:font-bold file:text-xs file:cursor-pointer cursor-pointer"
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="ghost" onClick={() => setCertModalCert(null)} disabled={certSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={certSaving}>
                  {certSaving ? 'Saving…' : 'Save Certificate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailContainer>
  );
};
