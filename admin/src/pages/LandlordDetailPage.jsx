import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash, Mail, Phone, MapPin,
  Building2, Flag, Calendar, ShieldCheck, Banknote, Home,
  CheckCircle2, AlertTriangle, Clock, FileText, User, Download
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import {StatusPill} from "../components/UI/StatusPill"
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';


export const LandlordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Bank details modal state
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_name: '', account_number: '', sort_code: '', iban_bic: '' });
  const [bankSaving, setBankSaving] = useState(false);

  // KYC update state
  const [kycForm, setKycForm] = useState({ kyc_status: 'not_started', kyc_ref: '' });
  const [kycSaving, setKycSaving] = useState(false);

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', address: '', company_name: '', initials: '',
    is_overseas: 'no', nrl_hmrc_ref: '', nrl_hmrc_approved: 'no',
    nrl_withhold_pct: '', ownership_share: '', tob_status: 'not_sent',
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Financials tab data
  const [transactions, setTransactions] = useState([]);
  const [pendingPayout, setPendingPayout] = useState(0);

  // Documents tab data
  const [allDocs, setAllDocs] = useState([]);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);

  // Bump to re-fetch after a mutation (verify / bank-details update).
  const [reloadKey, setReloadKey] = useState(0);
  const refetchLandlord = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const fetchLandlord = async () => {
      try {
        const res = await api.get(`/landlords/${id}`);
        setData(res.data.data);
        setKycForm({
          kyc_status: res.data.data.kyc_status || 'not_started',
          kyc_ref: res.data.data.kyc_ref || '',
        });
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load landlord', 'error');
        navigate('/landlords');
      } finally {
        setLoading(false);
      }
    };
    fetchLandlord();
  }, [id, navigate, addToast, reloadKey]);

  useEffect(() => {
    const fetchFinancials = async () => {
      try {
        const [txRes, stRes] = await Promise.all([
          api.get('/transactions', { params: { landlord_id: id } }),
          api.get('/statements'),
        ]);
        setTransactions(txRes.data.data || []);
        const statements = stRes.data.data || [];
        const pending = statements
          .filter((s) => String(s.landlord_id) === String(id) && s.status !== 'paid')
          .reduce((sum, s) => sum + (parseFloat(s.net_paid) || 0), 0);
        setPendingPayout(pending);
      } catch (err) {
        console.error(err);
        addToast(err.response?.data?.message || 'Failed to load financial data', 'error');
      }
    };
    fetchFinancials();
  }, [id, addToast]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await api.get('/documents/folders');
        const folders = res.data?.data || [];
        setAllDocs(folders.flatMap((f) => f.children || []));
      } catch (err) {
        console.error(err);
        addToast(err.response?.data?.message || 'Failed to load documents', 'error');
      }
    };
    fetchDocuments();
  }, [addToast, docsReloadKey]);

  const openEditModal = () => {
    setEditForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      company_name: data.company_name || '',
      initials: data.initials || '',
      is_overseas: data.is_overseas ? 'yes' : 'no',
      nrl_hmrc_ref: data.nrl_hmrc_ref || '',
      nrl_hmrc_approved: data.nrl_hmrc_approved ? 'yes' : 'no',
      nrl_withhold_pct: data.nrl_withhold_pct != null ? String(data.nrl_withhold_pct) : '',
      ownership_share: data.ownership_share != null ? String(data.ownership_share) : '',
      tob_status: data.tob_status || 'not_sent',
    });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});
    setEditSaving(true);
    try {
      await api.patch(`/landlords/${id}`, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        company_name: editForm.company_name || undefined,
        initials: editForm.initials || undefined,
        is_overseas: editForm.is_overseas === 'yes',
        nrl_hmrc_ref: editForm.nrl_hmrc_ref || undefined,
        nrl_hmrc_approved: editForm.nrl_hmrc_approved === 'yes',
        nrl_withhold_pct: editForm.nrl_withhold_pct !== '' ? parseFloat(editForm.nrl_withhold_pct) : undefined,
        ownership_share: editForm.ownership_share !== '' ? parseFloat(editForm.ownership_share) : undefined,
        tob_status: editForm.tob_status,
      });
      addToast('Landlord details updated successfully!', 'success');
      setIsEditModalOpen(false);
      refetchLandlord();
    } catch (err) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errorsObj = {};
        err.response.data.errors.forEach((er) => {
          errorsObj[er.field] = er.message;
        });
        setEditErrors(errorsObj);
      } else {
        addToast(err.response?.data?.message || 'Failed to update landlord details', 'error');
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDownloadDocument = async (file) => {
    try {
      const response = await api.get(`/documents/${file.id}/download`, {
        responseType: 'blob',
        skipInterceptorError: true,
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

  const handleUploadFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', 'landlord');
    formData.append('entityId', String(id));
    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('Document uploaded successfully!', 'success');
      setDocsReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to upload ${file.name}`, 'error');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setKycSaving(true);
    try {
      await api.patch(`/landlords/${id}/kyc`, kycForm);
      addToast('KYC status updated', 'success');
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update KYC status', 'error');
    } finally {
      setKycSaving(false);
    }
  };

  const handleVerifyBankDetails = async () => {
    const ok = await confirm({
      title: 'Verify Bank Details',
      message: `Confirm you have independently verified the bank details for ${data.name} (e.g. by calling the landlord on a known number). Payouts will use these details.`,
      confirmText: 'Mark as Verified',
    });
    if (!ok) return;
    try {
      await api.patch(`/landlords/${id}/payment-details/verify`);
      addToast('Bank details verified', 'success');
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to verify bank details', 'error');
    }
  };

  const openBankModal = () => {
    setBankForm({
      bank_name: data.bank_name || '',
      account_name: data.account_name || '',
      account_number: data.account_number || '',
      sort_code: data.sort_code || '',
      iban_bic: data.iban_bic || '',
    });
    setIsBankModalOpen(true);
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    try {
      await api.put(`/landlords/${id}/payment-details`, bankForm);
      addToast('Bank details submitted for verification', 'success');
      setIsBankModalOpen(false);
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update bank details', 'error');
    } finally {
      setBankSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Landlord',
      message: `Are you sure you want to delete ${data.name}? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Landlord',
    });
    
    if (ok) {
      try {
        await api.delete(`/landlords/${id}`);
        addToast('Landlord deleted successfully', 'success');
        navigate('/landlords');
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete landlord', 'error');
      }
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Clock },
    { id: 'portfolio', label: 'Portfolio', icon: Building2 },
    { id: 'financials', label: 'Financials', icon: Banknote },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'communication', label: 'Communication', icon: Mail }
  ];

  const isVerified = data.kyc_status === 'passed' || data.kyc_status === 'approved';

  // Financial summary derived from the transactions ledger.
  const currentYear = new Date().getFullYear();
  const ytdIncome = transactions
    .filter((t) => t.type === 'rent_in' && new Date(t.transaction_date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const ytdExpenses = transactions
    .filter((t) => t.type !== 'rent_in' && t.type !== 'landlord_payout' && new Date(t.transaction_date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
    .slice(0, 10);
  const formatMoney = (n) => `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const typeLabel = (type) => (type || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // This landlord's documents from the flattened folder tree.
  const landlordDocs = allDocs.filter(
    (d) => d.scope === 'landlord' && (d.entityId === data.landlord_reference || d.entityId === `LND-${id}`)
  );

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/landlords"
        backLabel="Back to Landlords"
        title={data.name}
        badge={
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wider uppercase ${
            isVerified ? 'bg-status-success-bg text-status-success border-status-success/15' :
            data.kyc_status === 'pending' ? 'bg-status-warning/10 text-status-warning border-status-warning/15' :
            'bg-status-danger-bg text-status-danger border-status-danger/15'
          }`}>
            {isVerified ? 'Verified' : data.kyc_status}
          </span>
        }
        subtitle={`${data.is_overseas ? 'OVERSEAS' : 'PERSONAL'} • Joined ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Profile"
        onEdit={() => openEditModal()}
        onDelete={handleDelete}
      />

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Landlord Summary">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={Hash} label="Reference ID" value={data.landlord_reference || `REM-LND-${data.id.toString().padStart(3, '0')}`} />
                    <DataRow icon={Mail} label="Email Address" value={data.email} />
                    <DataRow icon={Phone} label="Phone Number" value={data.phone} />
                    <DataRow icon={MapPin} label="Full Address" value={data.address} />
                  </div>
                  <div>
                    <DataRow icon={Building2} label="Ownership Type" value={data.is_overseas ? 'Overseas' : 'Personal'} />
                    <DataRow icon={Flag} label="Country" value={data.is_overseas ? 'Overseas' : 'United Kingdom'} />
                    <DataRow icon={Building2} label="Company Name" value={data.company_name || '—'} />
                    <DataRow icon={Hash} label="Ownership Share" value={data.ownership_share != null ? `${data.ownership_share}%` : '—'} />
                  </div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Verification Status">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${
                    isVerified ? 'bg-status-success-bg text-status-success' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {isVerified ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-brand-primary font-bold text-lg">{isVerified ? 'Verified' : 'Pending'}</h4>
                    <p className="text-xs text-status-muted mt-1 leading-relaxed">
                      {isVerified ? `Verified on ${data.tob_signed_at ? new Date(data.tob_signed_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}` : 'Awaiting verification'}
                      <br/>
                      {isVerified ? 'by Administrator' : ''}
                    </p>
                  </div>
                </div>

                {/* KYC update controls */}
                <form onSubmit={handleKycSubmit} className="mt-5 pt-4 border-t border-card-border flex flex-col gap-3">
                  <Dropdown
                    label="KYC Status"
                    id="kyc-status"
                    options={[
                      { value: 'not_started', label: 'Not Started' },
                      { value: 'pending', label: 'Pending Review' },
                      { value: 'passed', label: 'Passed' },
                      { value: 'failed', label: 'Failed' },
                    ]}
                    value={kycForm.kyc_status}
                    onChange={(val) => setKycForm(f => ({ ...f, kyc_status: val }))}
                  />
                  <Input
                    label="KYC Reference"
                    id="kyc-ref"
                    placeholder="e.g. HIPLA check ref"
                    value={kycForm.kyc_ref}
                    onChange={(e) => setKycForm(f => ({ ...f, kyc_ref: e.target.value }))}
                  />
                  <Button type="submit" variant="primary" disabled={kycSaving}>
                    {kycSaving ? 'Saving…' : 'Update KYC Status'}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Managed Properties">
                <p className="text-sm font-semibold text-status-muted mb-4">{data.properties?.length || 0} Property{data.properties?.length !== 1 ? 'ies' : ''}</p>
                <div className="flex flex-col gap-3">
                  {data.properties?.length > 0 ? data.properties.map(p => (
                    <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between p-4 bg-gray-50/50 border border-card-border rounded-xl hover:border-brand-accent cursor-pointer transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-brand-primary">
                          <Home size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-brand-primary group-hover:text-brand-accent transition-colors">{p.name || p.address_line1}</h4>
                          <p className="text-xs font-semibold text-status-muted mt-0.5">{p.property_reference || `Property #${p.id}`} • {p.city}, {p.postcode} • {p.property_type}</p>
                        </div>
                      </div>
                      <StatusPill status={p.status === 'let' ? 'active' : p.status === 'vacant' ? 'pending' : 'draft'} />
                    </div>
                  )) : <p className="text-sm text-gray-400 italic">No properties managed.</p>}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Important Dates">
                <DataRow icon={Calendar} label="Terms Signed" value={data.tob_signed_at ? new Date(data.tob_signed_at).toLocaleDateString('en-GB') : '—'} />
                <DataRow icon={Clock} label="Account Created" value={new Date(data.created_at).toLocaleDateString('en-GB')} />
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Financial Summary">
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Income</p>
                    <p className="text-2xl font-bold text-brand-primary">{formatMoney(ytdIncome)}</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Expenses</p>
                    <p className="text-2xl font-bold text-brand-primary">{formatMoney(ytdExpenses)}</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pending Payout</p>
                    <p className="text-2xl font-bold text-brand-primary">{formatMoney(pendingPayout)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-brand-primary">Recent Transactions</h4>
                  <button
                    onClick={() => navigate('/accounting')}
                    className="text-xs font-bold text-brand-accent hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {recentTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-card-border">
                          <th className="text-left py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                          <th className="text-left py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Description</th>
                          <th className="text-left py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Property</th>
                          <th className="text-left py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                          <th className="text-right py-2 text-2xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTransactions.map((t, idx) => (
                          <tr key={t.id ?? idx} className="border-b border-gray-50 last:border-0">
                            <td className="py-2.5 pr-3 text-xs font-semibold text-status-muted whitespace-nowrap">
                              {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="py-2.5 pr-3 text-xs font-semibold text-brand-primary">{t.description || '—'}</td>
                            <td className="py-2.5 pr-3 text-xs text-status-muted">{t.property_address || '—'}</td>
                            <td className="py-2.5 pr-3 text-xs text-status-muted whitespace-nowrap">{typeLabel(t.type)}</td>
                            <td className={`py-2.5 text-xs font-bold text-right whitespace-nowrap ${
                              t.type === 'rent_in' ? 'text-status-success' : 'text-status-danger'
                            }`}>
                              {t.type === 'rent_in' ? '' : '-'}£{(parseFloat(t.amount) || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-surface-light rounded-card border border-dashed border-card-border">
                    <Banknote size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-status-muted">No transactions found</p>
                    <p className="text-xs text-gray-400 mt-1">Rent payments and payouts will appear here.</p>
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Bank Details">
                {data.bank_name ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                      {data.change_pending ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wider uppercase bg-status-warning/10 text-status-warning border-status-warning/15">
                          <AlertTriangle size={12} /> Pending Verification
                        </span>
                      ) : data.verified_at ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wider uppercase bg-status-success-bg text-status-success border-status-success/15">
                          <CheckCircle2 size={12} /> Verified {new Date(data.verified_at).toLocaleDateString('en-GB')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wider uppercase bg-status-danger-bg text-status-danger border-status-danger/15">
                          <AlertTriangle size={12} /> Never Verified
                        </span>
                      )}
                    </div>
                    <DataRow icon={Banknote} label="Bank Name" value={data.bank_name} />
                    <DataRow icon={User} label="Account Name" value={data.account_name} />
                    <DataRow icon={Hash} label="Account No." value={data.account_number ? `****${String(data.account_number).slice(-4)}` : '—'} />
                    <DataRow icon={Hash} label="Sort Code" value={data.sort_code} />
                    {data.change_pending && data.change_requested_at ? (
                      <p className="text-xs text-gray-400 pt-2">
                        Change requested {new Date(data.change_requested_at).toLocaleDateString('en-GB')}
                      </p>
                    ) : null}
                    <div className="flex gap-2 pt-3">
                      {data.change_pending || !data.verified_at ? (
                        <Button type="button" variant="primary" onClick={handleVerifyBankDetails}>
                          Verify Details
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" onClick={openBankModal}>
                        Update Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 italic mb-3">No bank details recorded.</p>
                    <Button type="button" variant="ghost" onClick={openBankModal}>
                      Add Bank Details
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Uploaded Documents">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUploadFileChange}
                />
                {landlordDocs.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={uploadingDoc}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingDoc ? 'Uploading…' : 'Upload Document'}
                      </Button>
                    </div>
                    {landlordDocs.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3.5 bg-surface-light/50 border border-card-border rounded-card hover:bg-surface-light transition-colors gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="card-bg p-2 rounded-lg border border-card-border text-brand-accent shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-brand-primary truncate">{file.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-400 font-semibold mt-1">
                              {file.doc_reference && (
                                <>
                                  <span className="text-brand-primary font-bold bg-surface-hover px-1.5 py-0.5 rounded-sm border border-card-border">{file.doc_reference}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Uploaded: {file.date}</span>
                              <span>•</span>
                              <span>Size: {file.size}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadDocument(file)}
                          className="p-2 text-gray-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-colors border border-transparent hover:border-brand-accent/10 cursor-pointer shrink-0"
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
                    <p className="text-xs text-gray-400 mt-1">Contracts, IDs, and agreements will appear here.</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingDoc}
                      className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm cursor-pointer"
                    >
                      {uploadingDoc ? 'Uploading…' : 'Upload Document'}
                    </button>
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Compliance Checklist">
                <div className="flex flex-col gap-3">
                  {data.compliance_checklist?.length > 0 ? data.compliance_checklist.map(item => (
                    <div key={item.id} className="flex items-center justify-between pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                      <span className="text-xs-portal font-semibold text-brand-primary">{item.item_label}</span>
                      <span className={`text-2xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border ${
                        item.status === 'complete' ? 'bg-status-success-bg text-status-success border-status-success/15' : 'bg-status-warning/10 text-status-warning border-status-warning/15'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  )) : <p className="text-sm text-gray-400 italic">No checklist items.</p>}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'communication' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Communication History">
                <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                  <Mail size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No recent communications</p>
                  <p className="text-xs text-gray-400 mt-1">Emails and automated messages sent to this landlord will appear here.</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl mx-4 border border-card-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-brand-primary mb-4">Edit Landlord Details</h3>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  id="edit_name"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  error={editErrors.name}
                />
                <Input
                  label="Email Address"
                  id="edit_email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  error={editErrors.email}
                />
                <Input
                  label="Contact Phone"
                  id="edit_phone"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  error={editErrors.phone}
                />
                <Input
                  label="Address"
                  id="edit_address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  error={editErrors.address}
                />
                <Input
                  label="Company Name (optional)"
                  id="edit_company_name"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  error={editErrors.company_name}
                />
                <Input
                  label="Initials (statements)"
                  id="edit_initials"
                  placeholder="e.g. RB/GH"
                  value={editForm.initials}
                  onChange={(e) => setEditForm({ ...editForm, initials: e.target.value })}
                  error={editErrors.initials}
                />
                <Dropdown
                  label="Residency"
                  id="edit_is_overseas"
                  options={[
                    { value: 'no', label: 'UK Resident' },
                    { value: 'yes', label: 'Overseas (NRL)' }
                  ]}
                  value={editForm.is_overseas}
                  onChange={(val) => setEditForm({ ...editForm, is_overseas: val })}
                />
                <Input
                  label="NRL Withholding (%)"
                  id="edit_nrl_withhold_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="20.00"
                  value={editForm.nrl_withhold_pct}
                  onChange={(e) => setEditForm({ ...editForm, nrl_withhold_pct: e.target.value })}
                  error={editErrors.nrl_withhold_pct}
                />
                <Input
                  label="NRL Number (HMRC)"
                  id="edit_nrl_hmrc_ref"
                  placeholder="e.g. NL945005"
                  value={editForm.nrl_hmrc_ref}
                  onChange={(e) => setEditForm({ ...editForm, nrl_hmrc_ref: e.target.value })}
                  error={editErrors.nrl_hmrc_ref}
                />
                <Dropdown
                  label="NRL HMRC Approved"
                  id="edit_nrl_hmrc_approved"
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' }
                  ]}
                  value={editForm.nrl_hmrc_approved}
                  onChange={(val) => setEditForm({ ...editForm, nrl_hmrc_approved: val })}
                />
                <Input
                  label="Ownership Share (%)"
                  id="edit_ownership_share"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="100.00"
                  value={editForm.ownership_share}
                  onChange={(e) => setEditForm({ ...editForm, ownership_share: e.target.value })}
                  error={editErrors.ownership_share}
                />
                <Dropdown
                  label="Terms of Business"
                  id="edit_tob_status"
                  options={[
                    { value: 'not_sent', label: 'Not Sent' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'signed', label: 'Signed' }
                  ]}
                  value={editForm.tob_status}
                  onChange={(val) => setEditForm({ ...editForm, tob_status: val })}
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Bank Details Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <h3 className="text-lg font-bold text-brand-primary mb-1">Update Bank Details</h3>
            <p className="text-xs text-status-muted mb-4">Changes are held as pending until verified by an administrator. Payouts should not be made against unverified details.</p>

            <form onSubmit={handleBankSubmit} className="flex flex-col gap-4">
              <Input
                label="Bank Name"
                id="bank_name"
                required
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
              />
              <Input
                label="Account Name"
                id="account_name"
                required
                value={bankForm.account_name}
                onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })}
              />
              <Input
                label="Account Number"
                id="account_number"
                required
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
              />
              <Input
                label="Sort Code"
                id="sort_code"
                required
                value={bankForm.sort_code}
                onChange={(e) => setBankForm({ ...bankForm, sort_code: e.target.value })}
              />
              <Input
                label="IBAN / BIC (optional)"
                id="iban_bic"
                value={bankForm.iban_bic}
                onChange={(e) => setBankForm({ ...bankForm, iban_bic: e.target.value })}
              />

              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsBankModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={bankSaving}>
                  {bankSaving ? 'Saving…' : 'Submit for Verification'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailContainer>
  );
};

