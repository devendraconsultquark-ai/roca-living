import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ShieldCheck, Users, Wrench, FileText, Clock, Receipt, Upload, Image as ImageIcon, X, PoundSterling, ClipboardCheck, Zap, History, StickyNote, AlertTriangle
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { StatusPill } from '../components/UI/StatusPill';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs, CertBadge, urgencyColor } from '../components/UI/DetailComponents';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import { DocumentUploadModal } from '../components/UI/DocumentUploadModal';
import { DocumentPreviewModal } from '../components/UI/DocumentPreviewModal';
import { DocumentList } from '../components/UI/DocumentList';
import { PropertyFinancials } from '../components/UI/PropertyFinancials';
import { PropertyPhotos } from '../components/UI/PropertyPhotos';
import { PropertyExpenses } from '../components/UI/PropertyExpenses';
import { PropertyOverview } from '../components/UI/PropertyOverview';
import { PropertyInspections, PropertyUtilities, PropertyTimeline, PropertyNotesTab } from '../components/UI/PropertyExtraTabs';
import { PropertyThumb } from '../components/UI/PropertyImage';
import { EstatesApartmentInfo } from '../components/UI/EstatesViews';
import { EstatesApartmentForm } from '../components/UI/EstatesApartmentForm';
import { useEstatesEditable } from '../utilities/useEstatesEditable';
import { EstatesDeleteModal } from '../components/UI/EstatesDeleteModal';
import api from '../utilities/api';
import { InfoTip } from '../components/UI/InfoTip';

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
  // Lettings details and the address as printed on statements; the block code,
  // apartment number and owner link come from ROCA Estates.
  const [editingProperty, setEditingProperty] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    rent_pcm: '',
    mgmt_fee_pct: '8.00',
    key_ref: '',
    notes: '',
    status: 'onboarding'
  });
  const [formErrors, setFormErrors] = useState({});

  // Documents tab
  const [documents, setDocuments] = useState([]);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileInputRef = useRef(null);
  const [docsReloadKey, setDocsReloadKey] = useState(0);

  // Bump to re-fetch after a mutation (certificate update).
  const [reloadKey, setReloadKey] = useState(0);
  // ROCA Estates apartment details, edited here and saved there.
  const estatesEditable = useEstatesEditable();
  const [editingEstates, setEditingEstates] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Next inspection for the top strip: from the latest logged inspection
  const [nextInspection, setNextInspection] = useState(null);
  useEffect(() => {
    api.get('/inspections', { params: { property_id: id }, skipInterceptorError: true })
      .then((res) => setNextInspection((res.data.data || []).find((i) => i.next_inspection_due)?.next_inspection_due || null))
      .catch(() => setNextInspection(null));
  }, [id]);

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
      rent_pcm: data.rent_pcm != null ? String(data.rent_pcm) : '',
      mgmt_fee_pct: data.mgmt_fee_pct != null ? String(data.mgmt_fee_pct) : '8.00',
      key_ref: data.key_ref || '',
      notes: data.notes || '',
      status: data.status || 'onboarding'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Copy the address / owner details from ROCA Estates when it has them.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshFromEstates = async () => {
    setRefreshing(true);
    try {
      const res = await api.post(`/properties/${id}/refresh-from-estates`);
      addToast(res.data.message, res.data.data.updated.length ? 'success' : 'info');
      if (res.data.data.updated.length) {
        setIsEditModalOpen(false);
        setReloadKey((k) => k + 1);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to refresh from ROCA Estates', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // ROCA Estates has another owner for this flat: moving it is the admin's call,
  // because its future statements and Xero landlord bills follow the owner.
  const [acceptingOwner, setAcceptingOwner] = useState(false);
  const handleAcceptOwner = async () => {
    const owner = data.estates_owner;
    const ok = await confirm({
      title: `Change the owner to ${owner.name}?`,
      message: `ROCA Estates lists ${owner.name} as the owner. Future statements and Xero landlord bills for this flat will go to ${owner.name}. Statements already made keep ${data.landlord_name}.`,
      confirmText: 'Change owner',
      variant: 'danger',
    });
    if (!ok) return;
    setAcceptingOwner(true);
    try {
      const res = await api.post(`/estates/properties/${data.rocaem_property_id}/accept-owner`, { confirm_owner_change: true });
      addToast(res.data.message, 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not change the owner', 'error');
    } finally {
      setAcceptingOwner(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      await api.patch(`/properties/${id}`, editingProperty);
      addToast('Lettings details updated', 'success');
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

  const handleDocDelete = async (doc) => {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Delete ${doc.name}? It is removed from Documents too.`,
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/documents/${doc.id}`, { skipInterceptorError: true });
      addToast('Document deleted', 'success');
      setDocsReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete the document', 'error');
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

  // Picking a file only stages it — the upload happens from the review modal,
  // where the admin sees the file and chooses its folder first.
  const handleDocUpload = (file) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setPendingUpload(file);
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


  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  // Design order (p5–p13), then Roca Living's own Photos and Expenses tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'safety', label: 'Compliance', icon: ShieldCheck },
    { id: 'financials', label: 'Financials', icon: Receipt },
    { id: 'tenancy', label: 'Tenancy', icon: Users },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
    { id: 'utilities', label: 'Utilities', icon: Zap },
    { id: 'timeline', label: 'Timeline', icon: History },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
    { id: 'expenses', label: 'Expenses', icon: PoundSterling }
  ];

  const address = `${data.address_line1}${data.address_line2 ? ', ' + data.address_line2 : ''}, ${data.city} ${data.postcode}`;
  const primaryImage = (data.images || []).find((i) => i.is_primary) || (data.images || []).find((i) => i.image_type === 'photo') || null;

  return (
    <DetailContainer>
      {/* Upload input shared by the Overview and Documents tabs */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleDocUpload(e.target.files?.[0])}
      />
      <DetailHeader
        backPath="/properties"
        backLabel="Back to Properties"
        title={data.name || data.address_line1}
        badge={<StatusPill status={data.status === 'let' ? 'active' : data.status === 'vacant' ? 'pending' : 'draft'} />}
        subtitle={`${data.property_reference} • ${address} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Details"
        onEdit={openEditModal}
        deleteLabel="Delete"
        onDelete={estatesEditable && data.rocaem_property_id ? () => setDeleting(true) : undefined}
      />

      {data.estates_owner && estatesEditable && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="text-status-warning shrink-0" />
          <p className="text-sm text-brand-primary flex-1">
            ROCA Estates has a different owner for this flat: <b>{data.estates_owner.name}</b>. Roca Living still has <b>{data.landlord_name}</b>, so statements and Xero bills still go to them.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={handleAcceptOwner} disabled={acceptingOwner}>
            {acceptingOwner ? 'Changing…' : `Change owner to ${data.estates_owner.name}`}
          </Button>
        </div>
      )}

      {/* Top strip (design): tenancy at a glance */}
      {(() => {
        const t = data.active_tenancy;
        const dep = t?.deposit;
        const depAmount = dep?.tenancy_deposit != null ? parseFloat(dep.tenancy_deposit) : null;
        const fmtMoney = (v) => `£${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const fmtDate = (ymd) => (ymd ? new Date(ymd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
        const items = [
          { label: 'Tenancy Status', value: t ? (t.status === 'notice' ? 'Notice given' : 'Let') : 'Vacant', tone: t ? (t.status === 'notice' ? 'text-status-warning' : 'text-status-success') : 'text-gray-400' },
          { label: 'Tenant', value: t?.tenants?.length ? t.tenants.map((x) => x.name).join(', ') : '—' },
          { label: 'Monthly Rent', value: t?.rent_pcm ? `${fmtMoney(t.rent_pcm)} pcm` : (data.rent_pcm ? `${fmtMoney(data.rent_pcm)} pcm` : '—') },
          {
            label: 'Deposit Held',
            value: depAmount ? fmtMoney(depAmount) : '—',
            badge: depAmount ? (dep.registered_at ? 'Protected' : 'Not protected') : null,
            badgeTone: dep?.registered_at ? 'bg-status-success-bg text-status-success' : 'bg-status-warning/10 text-status-warning',
          },
          { label: 'Next Inspection', value: fmtDate(nextInspection) },
          { label: 'Landlord', value: data.landlord_name || '—' },
        ];
        return (
          <div className="card-bg border border-card-border rounded-card shadow-premium p-3 mb-6 flex flex-col md:flex-row md:items-center gap-4">
            <PropertyThumb
              imageId={primaryImage?.id}
              fallbackKey={data.apartment_number || data.id}
              alt={data.name || data.address_line1}
              className="w-full md:w-48 h-28 rounded-card border border-card-border shrink-0"
              iconSize={26}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 flex-1 px-2">
            {items.map((it) => (
              <div key={it.label} className="min-w-0">
                <p className="text-2xs font-bold text-status-muted">{it.label}</p>
                <p className={`text-sm font-bold mt-1 truncate ${it.tone || 'text-brand-primary'}`} title={it.value}>
                  {it.value}
                  {it.badge && <span className={`ml-2 px-1.5 py-0.5 rounded-sm text-2xs font-bold align-middle ${it.badgeTone}`}>{it.badge}</span>}
                </p>
              </div>
            ))}
            </div>
          </div>
        );
      })()}

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'photos' && <PropertyPhotos propertyId={id} sharedFloorPlan={!!data.rocaem_property_id && estatesEditable} onChanged={() => setReloadKey((k) => k + 1)} />}
        {activeTab === 'financials' && <PropertyFinancials propertyId={id} unit={data.block_name && data.apartment_number ? `${data.block_name}-${data.apartment_number}` : null} />}
        {activeTab === 'expenses' && <PropertyExpenses propertyId={id} />}
        {activeTab === 'inspections' && <PropertyInspections propertyId={id} />}
        {activeTab === 'utilities' && <PropertyUtilities propertyId={id} />}
        {activeTab === 'timeline' && <PropertyTimeline data={data} documents={documents} />}
        {activeTab === 'notes' && <PropertyNotesTab data={data} onEdit={openEditModal} />}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            <PropertyOverview
              data={data}
              documents={documents}
              onTab={setActiveTab}
              onDownloadDoc={handleDocDownload}
              onPreviewDoc={setPreviewDoc}
              onUploadDoc={() => fileInputRef.current?.click()}
              onEditNotes={openEditModal}
            />
            {/* What the ROCA Estates pop-up on the Properties list used to show */}
            <Card title="Apartment (ROCA Estates)">
              <EstatesApartmentInfo
                key={reloadKey}
                rocaemId={data.rocaem_property_id}
                onEdit={estatesEditable && data.rocaem_property_id ? () => setEditingEstates(true) : undefined}
              />
            </Card>
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
                            {t.is_lead_tenant && <span className="text-2xs capitalize font-bold bg-status-info-bg text-status-info border border-status-info/15 px-2 py-0.5 rounded-sm">Lead Tenant</span>}
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
                        <span className={`text-2xs font-bold px-2 py-0.5 rounded-sm border capitalize ${urgencyColor[t.urgency] || urgencyColor.routine}`}>
                          {t.urgency}
                        </span>
                        <span className="text-2xs font-bold bg-surface-hover text-gray-400 border border-card-border px-2 py-0.5 rounded-sm capitalize">
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
                        <span className={`text-2xs capitalize font-bold px-2 py-0.5 rounded-sm border ${
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
                {documents.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        icon={Upload}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload Document
                      </Button>
                    </div>
                    <DocumentList documents={documents} onPreview={setPreviewDoc} onDownload={handleDocDownload} onDelete={handleDocDelete} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                    <FileText size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No documents uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">Leases, floor plans, and instructions will appear here.</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm cursor-pointer"
                    >
                      Upload Document
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
            <div className="flex justify-between items-start gap-3 mb-1">
              <h3 className="text-lg font-bold text-brand-primary flex items-center gap-1.5">
                Edit Details
                <InfoTip text={data.rocaem_property_id && estatesEditable
                  ? 'The address is saved in ROCA Estates too. Rent, fee, key and notes are Roca Living’s own.'
                  : 'This address prints on statements. Block, apartment number and owner come from ROCA Estates.'} />
              </h3>
              <button type="button" onClick={() => { setIsEditModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4" />

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              {data.rocaem_property_id && estatesEditable && (
                <Button type="button" variant="secondary" size="sm" onClick={() => { setIsEditModalOpen(false); setEditingEstates(true); }}>
                  Edit all apartment details (certificates, lease, floor plan)
                </Button>
              )}
              {data.rocaem_property_id && !estatesEditable && (
                <Button type="button" variant="secondary" size="sm" onClick={handleRefreshFromEstates} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh address & owner from ROCA Estates'}
                </Button>
              )}
              <Input label="Address Line 1" id="edit_address_line1" value={editingProperty.address_line1} onChange={(e) => setEditingProperty({ ...editingProperty, address_line1: e.target.value })} error={formErrors.address_line1} />
              <Input label="Address Line 2" id="edit_address_line2" value={editingProperty.address_line2} onChange={(e) => setEditingProperty({ ...editingProperty, address_line2: e.target.value })} error={formErrors.address_line2} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Town / City" id="edit_city" value={editingProperty.city} onChange={(e) => setEditingProperty({ ...editingProperty, city: e.target.value })} error={formErrors.city} />
                <Input label="Postcode" id="edit_postcode" value={editingProperty.postcode} onChange={(e) => setEditingProperty({ ...editingProperty, postcode: e.target.value })} error={formErrors.postcode} />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-between items-start gap-3 mb-1">
              <h3 className="text-lg font-bold text-brand-primary flex items-center gap-1.5">Update {certModalCert.cert_type} Certificate <InfoTip text="Status (compliant, expiring soon, expired) comes from the expiry date." /></h3>
              <button type="button" onClick={() => setCertModalCert(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="mb-4" />

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
                <label htmlFor="cert_file" className="text-xs font-semibold text-status-muted capitalize tracking-wide">
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

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} onDownload={handleDocDownload} />

      <DocumentUploadModal
        file={pendingUpload}
        scope="property"
        entityId={id}
        onClose={() => setPendingUpload(null)}
        onUploaded={() => {
          setPendingUpload(null);
          setDocsReloadKey((k) => k + 1);
        }}
      />
      {editingEstates && (
        <EstatesApartmentForm
          rocaemId={data.rocaem_property_id}
          onClose={() => { setEditingEstates(false); setReloadKey((k) => k + 1); }}
          onSaved={() => { setEditingEstates(false); setReloadKey((k) => k + 1); }}
        />
      )}
      {deleting && (
        <EstatesDeleteModal
          kind="apartment"
          rocaemId={data.rocaem_property_id}
          confirmWord={data.block_name && data.apartment_number ? `${data.block_name}-${data.apartment_number}` : (data.name || data.address_line1)}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/properties', { replace: true })}
        />
      )}
    </DetailContainer>
  );
};
