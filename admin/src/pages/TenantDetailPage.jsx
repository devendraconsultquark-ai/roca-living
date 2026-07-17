import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Users, Phone, Mail, ShieldCheck,
  Home, CreditCard, Clock, AlertTriangle, Hash, FileText, X, Download, Upload
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

const rtrColors = {
  verified: 'bg-status-success/10 text-status-success',
  pending: 'bg-status-warning/10 text-status-warning',
  failed: 'bg-status-danger/10 text-status-danger',
};

const methodLabel = { bank_transfer: 'Bank Transfer', direct_debit: 'Direct Debit', card: 'Card', cash: 'Cash', other: 'Other' };

export const TenantDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit profile modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    right_to_rent_status: 'pending',
    right_to_rent_expiry: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Documents tab
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [docsReloadKey, setDocsReloadKey] = useState(0);

  // Bump to re-fetch after a mutation (profile edit).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await api.get(`/tenancies/tenants/${id}`);
        setData(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load tenant', 'error');
        navigate('/tenants');
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [id, navigate, addToast, reloadKey]);

  // Documents linked to this tenant's tenancy (entityId is "TCY-<id>" or "TCY-<id> @ <property ref>").
  const tenancyId = data?.tenancy?.id;
  useEffect(() => {
    if (!tenancyId) return;
    const fetchDocuments = async () => {
      try {
        const res = await api.get('/documents/folders', { skipInterceptorError: true });
        const allDocs = (res.data?.data || []).flatMap((folder) => folder.children || []);
        setDocuments(allDocs.filter((d) =>
          d.scope === 'tenancy' &&
          typeof d.entityId === 'string' &&
          (d.entityId === `TCY-${tenancyId}` || d.entityId.startsWith(`TCY-${tenancyId} `))
        ));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load documents', 'error');
      }
    };
    fetchDocuments();
  }, [tenancyId, addToast, docsReloadKey]);

  const openEditModal = () => {
    setEditForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      right_to_rent_status: data.right_to_rent_status || 'pending',
      right_to_rent_expiry: data.right_to_rent_expiry || ''
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.name.trim()) errs.name = 'Full name is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.patch(`/tenancies/tenants/${id}`, editForm);
      addToast('Tenant details updated successfully!', 'success');
      setIsEditModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update tenant details', 'error');
    } finally {
      setSubmitting(false);
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
    if (!file || !tenancyId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', 'tenancy');
    formData.append('entityId', String(tenancyId));
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

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Tenant',
      message: `Are you sure you want to delete ${data.name}? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Tenant',
    });
    
    if (ok) {
      try {
        await api.delete(`/tenancies/tenants/${id}`);
        addToast('Tenant deleted successfully', 'success');
        navigate('/tenants');
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete tenant', 'error');
      }
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'tenancy', label: 'Tenancy', icon: Home },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  const balance = parseFloat(data.balance || 0);

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/tenants"
        backLabel="Back to Tenants"
        title={data.name}
        badge={
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wide uppercase ${
            balance < 0 ? 'bg-status-danger-bg text-status-danger border-status-danger/15' : 'bg-status-success-bg text-status-success border-status-success/15'
          }`}>
            Balance: {balance < 0 ? `-£${Math.abs(balance).toFixed(2)}` : `£${balance.toFixed(2)}`}
          </span>
        }
        subtitle={`${data.is_lead_tenant ? 'LEAD TENANT' : 'CO-TENANT'} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Profile"
        onEdit={openEditModal}
        onDelete={handleDelete}
      />

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Tenant Summary">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={Hash} label="Tenant ID" value={`TNT-${data.id.toString().padStart(4, '0')}`} />
                    <DataRow icon={Mail} label="Email Address" value={data.email} />
                    <DataRow icon={Phone} label="Phone Number" value={data.phone} />
                  </div>
                  <div>
                    <DataRow icon={User} label="Tenant Role" value={data.is_lead_tenant ? 'Lead Tenant' : 'Co-Tenant'} />
                  </div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Right to Rent">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${
                    data.right_to_rent_status === 'verified' ? 'bg-status-success-bg text-status-success' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {data.right_to_rent_status === 'verified' ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-brand-primary font-bold text-lg capitalize">{data.right_to_rent_status || 'Pending'}</h4>
                    <p className="text-xs text-status-muted mt-1 leading-relaxed">
                      {data.right_to_rent_status === 'verified' ? `Expiry: ${data.right_to_rent_expiry ? new Date(data.right_to_rent_expiry).toLocaleDateString('en-GB') : 'N/A'}` : 'Awaiting verification'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tenancy' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Current Tenancy">
                {data.tenancy ? (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                      <div className="col-span-2">
                         <DataRow icon={Home} label="Property" value={data.tenancy.property_address} />
                      </div>
                      <div>
                        <DataRow icon={Clock} label="Start Date" value={data.tenancy.start_date ? new Date(data.tenancy.start_date).toLocaleDateString('en-GB') : null} />
                        <DataRow icon={Clock} label="End Date" value={data.tenancy.end_date ? new Date(data.tenancy.end_date).toLocaleDateString('en-GB') : 'Periodic'} />
                      </div>
                      <div>
                        <DataRow icon={User} label="Landlord" value={data.tenancy.landlord_name} />
                        <DataRow icon={CreditCard} label="Rent PCM" value={`£${parseFloat(data.tenancy.rent_pcm).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-xl border border-dashed border-card-border">
                    <Home size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No active tenancy</p>
                    <p className="text-xs text-gray-400 mt-1">This tenant is not currently assigned to a property.</p>
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Co-Tenants">
                {data.co_tenants?.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {data.co_tenants.map(t => (
                      <div
                        key={t.id}
                        onClick={() => navigate(`/tenants/${t.id}`)}
                        className="flex items-center justify-between bg-surface-light hover:border-brand-accent border border-card-border/30 rounded-xl px-4 py-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                            <Users size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-brand-primary">{t.name}</p>
                          </div>
                        </div>
                        {t.is_lead_tenant ? <span className="text-2xs uppercase font-bold bg-brand-accent/10 text-brand-accent px-2 py-1 rounded-md">Lead</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No co-tenants.</p>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="grid grid-cols-1 gap-6">
            <Card title={`Rent Payment History (${data.payment_history?.length || 0})`}>
              {data.payment_history?.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-card-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                        <th className="text-left py-3 px-4">Date</th>
                        <th className="text-left py-3 px-4">Amount</th>
                        <th className="text-left py-3 px-4">Method</th>
                        <th className="text-left py-3 px-4">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs-portal">
                      {data.payment_history.map(p => (
                        <tr key={p.id} className="hover:bg-surface-light/50 transition-colors">
                          <td className="py-3 px-4 text-status-muted font-medium">{p.received_at ? new Date(p.received_at).toLocaleDateString('en-GB') : '—'}</td>
                          <td className="py-3 px-4 font-bold text-brand-primary">£{parseFloat(p.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-status-muted">{methodLabel[p.method] || p.method}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs font-mono">{p.reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-xl border border-dashed border-card-border">
                  <CreditCard size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No payment history</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Tenant Documents">
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
                              <span className="text-brand-accent">Tenancy</span>
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
                  <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-xl border border-dashed border-card-border">
                    <FileText size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No documents uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {tenancyId
                        ? 'IDs, references, and agreements will appear here.'
                        : 'This tenant has no tenancy, so documents cannot be uploaded yet.'}
                    </p>
                    {tenancyId && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uploading ? 'Uploading…' : 'Upload Document'}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Tenant Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Edit Tenant Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Full Name"
                id="edit-t-name"
                required
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                error={formErrors.name}
              />
              <Input
                label="Email Address"
                id="edit-t-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="edit-t-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Dropdown
                label="Right to Rent Status"
                id="edit-t-rtr-status"
                placeholder="Select status"
                value={editForm.right_to_rent_status}
                onChange={(val) => setEditForm(f => ({ ...f, right_to_rent_status: val }))}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'verified', label: 'Approved (Verified)' },
                  { value: 'failed', label: 'Rejected (Failed)' }
                ]}
              />
              <Input
                label="Right to Rent Expiry"
                id="edit-t-rtr-expiry"
                type="date"
                value={editForm.right_to_rent_expiry}
                onChange={(e) => setEditForm(f => ({ ...f, right_to_rent_expiry: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailContainer>
  );
};
