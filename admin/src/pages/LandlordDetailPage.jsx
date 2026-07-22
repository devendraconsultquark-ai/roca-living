import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash, Mail, Phone, MapPin,
  Building2, Flag, Calendar, ShieldCheck, Banknote, Home,
  CheckCircle2, AlertTriangle, Clock, FileText, User, Download,
  Wallet, Upload, Wrench, PoundSterling, ClipboardList, TrendingUp
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import { StatusPill } from "../components/UI/StatusPill";
import { StatCard } from '../components/UI/StatCard';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import { ActivationLinkModal } from '../components/UI/ActivationLinkModal';
import { DocumentUploadModal } from '../components/UI/DocumentUploadModal';
import { PropertyThumb } from '../components/UI/PropertyImage';
import api from '../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Certificate buckets (mirrors the Compliance page)
const CERT_BUCKETS = {
  compliant: { label: 'Compliant', pill: 'bg-status-success-bg text-status-success' },
  due_30: { label: 'Due (30 days)', pill: 'bg-status-warning/10 text-status-warning' },
  due_60: { label: 'Due (60 days)', pill: 'bg-status-warning/10 text-status-warning' },
  overdue: { label: 'Overdue', pill: 'bg-status-danger-bg text-status-danger' },
  not_uploaded: { label: 'Not Uploaded', pill: 'bg-surface-hover text-gray-400' },
};
const certBucketOf = (c) => {
  if (c.days_left === null) return 'not_uploaded';
  if (c.days_left < 0) return 'overdue';
  if (c.days_left <= 30) return 'due_30';
  if (c.days_left <= 60) return 'due_60';
  return 'compliant';
};

const PORTFOLIO_COLORS = { let: '#3A7D44', vacant: '#E8A020', onboarding: '#0A58CA' };

const relativeTime = (d) => {
  if (!d) return null;
  const days = Math.floor((new Date() - new Date(d)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

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
  const [bankErrors, setBankErrors] = useState({});
  const [bankSaving, setBankSaving] = useState(false);

  const handleBankChange = (field) => (e) => {
    setBankForm((f) => ({ ...f, [field]: e.target.value }));
    if (bankErrors[field]) {
      setBankErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // KYC update state
  const [kycForm, setKycForm] = useState({ kyc_status: 'not_started', kyc_ref: '', sanctions_checked: 'no' });
  const [kycSaving, setKycSaving] = useState(false);

  // One-time set-password link ({ name, link, expiresAt })
  const [activationInfo, setActivationInfo] = useState(null);
  const [activationLoading, setActivationLoading] = useState(false);

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', address: '', company_name: '', initials: '',
    is_overseas: 'no', nrl_hmrc_ref: '', nrl_hmrc_approved: 'no',
    nrl_withhold_pct: '', ownership_share: '', tob_status: 'not_sent',
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Financials / statements / arrears data
  const [transactions, setTransactions] = useState([]);
  const [statementsList, setStatementsList] = useState([]);
  const [pendingPayout, setPendingPayout] = useState(0);
  const [arrearsTotal, setArrearsTotal] = useState(0);

  // Compliance certificates, activity feed, account managers
  const [myCerts, setMyCerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [managers, setManagers] = useState([]);
  const [managerSel, setManagerSel] = useState('');
  const [managerSaving, setManagerSaving] = useState(false);

  // Notes
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // Documents tab data
  const [allDocs, setAllDocs] = useState([]);
  const [docsReloadKey, setDocsReloadKey] = useState(0);
  const [pendingUpload, setPendingUpload] = useState(null);
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
          sanctions_checked: res.data.data.sanctions_checked ? 'yes' : 'no',
        });
        setNotesDraft(res.data.data.notes || '');
        setManagerSel(res.data.data.account_manager_id ? String(res.data.data.account_manager_id) : '');
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
        const [txRes, stRes, arRes] = await Promise.all([
          api.get('/transactions', { params: { landlord_id: id } }),
          api.get('/statements'),
          api.get('/reports/arrears'),
        ]);
        setTransactions(txRes.data.data || []);
        const statements = (stRes.data.data || []).filter((s) => String(s.landlord_id) === String(id));
        setStatementsList(statements);
        setPendingPayout(statements
          .filter((s) => s.status !== 'paid')
          .reduce((sum, s) => sum + (parseFloat(s.net_paid) || 0), 0));
        const mine = (arRes.data.data?.landlord_summary || []).find((l) => String(l.landlord_id) === String(id));
        setArrearsTotal(mine ? parseFloat(mine.total_arrears) : 0);
      } catch (err) {
        console.error(err);
        addToast(err.response?.data?.message || 'Failed to load financial data', 'error');
      }
    };
    fetchFinancials();
  }, [id, addToast]);

  useEffect(() => {
    const fetchExtras = async () => {
      const [certRes, actRes, mgrRes] = await Promise.allSettled([
        api.get('/reports/compliance-items'),
        api.get(`/landlords/${id}/activity`),
        api.get('/landlords/managers'),
      ]);
      if (certRes.status === 'fulfilled') {
        setMyCerts((certRes.value.data.data || []).filter((c) => String(c.landlord_id) === String(id)));
      }
      if (actRes.status === 'fulfilled') setActivity(actRes.value.data.data || []);
      if (mgrRes.status === 'fulfilled') setManagers(mgrRes.value.data.data || []);
    };
    fetchExtras();
  }, [id]);

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

  // Picking a file only stages it — the upload happens from the review modal,
  // where the admin sees the file and chooses its folder first.
  const handleUploadFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setPendingUpload(file);
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setKycSaving(true);
    try {
      await api.patch(`/landlords/${id}/kyc`, {
        kyc_status: kycForm.kyc_status,
        kyc_ref: kycForm.kyc_ref,
        sanctions_checked: kycForm.sanctions_checked === 'yes',
      });
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

  const handleGenerateActivationLink = async () => {
    setActivationLoading(true);
    try {
      const res = await api.post(`/landlords/${id}/activation-link`);
      setActivationInfo({
        name: data.name,
        link: res.data.data.activation_link,
        expiresAt: res.data.data.activation_expires_at
      });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to generate activation link', 'error');
    } finally {
      setActivationLoading(false);
    }
  };

  const handleToggleOwnership = async () => {
    const confirming = !data.ownership_confirmed;
    const ok = await confirm({
      title: confirming ? 'Confirm Ownership' : 'Revoke Ownership Confirmation',
      message: confirming
        ? `Confirm you have verified that ${data.name} owns the properties under management (e.g. via a Land Registry title check).`
        : `Mark ownership for ${data.name} as unconfirmed? The compliance checklist item will return to pending.`,
      confirmText: confirming ? 'Confirm Ownership' : 'Mark Unconfirmed',
    });
    if (!ok) return;
    try {
      await api.patch(`/landlords/${id}`, { ownership_confirmed: confirming });
      addToast(confirming ? 'Ownership confirmed' : 'Ownership confirmation revoked', 'success');
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update ownership confirmation', 'error');
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await api.patch(`/landlords/${id}`, { notes: notesDraft });
      addToast('Notes saved', 'success');
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save notes', 'error');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleSaveManager = async () => {
    setManagerSaving(true);
    try {
      await api.patch(`/landlords/${id}`, { account_manager_id: managerSel === '' ? null : Number(managerSel) });
      addToast('Account manager updated', 'success');
      refetchLandlord();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update account manager', 'error');
    } finally {
      setManagerSaving(false);
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
    setBankErrors({});
    setIsBankModalOpen(true);
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    setBankErrors({});
    try {
      await api.put(`/landlords/${id}/payment-details`, bankForm);
      addToast('Bank details submitted for verification', 'success');
      setIsBankModalOpen(false);
      refetchLandlord();
    } catch (err) {
      const errorMessages = err.response?.data?.errors;
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          errorsMap[m.field] = m.message;
        });
        setBankErrors(errorsMap);
        addToast(err.response?.data?.message || 'Validation failed', 'error');
      } else {
        addToast(err.response?.data?.message || 'Failed to update bank details', 'error');
      }
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
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'financials', label: 'Financials', icon: Banknote },
    { id: 'statements', label: 'Statements', icon: FileText },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'documents', label: 'Documents', icon: Download },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: User },
  ];

  const isVerified = data.kyc_status === 'passed';
  const kycBadge = {
    passed: { label: 'Verified', classes: 'bg-status-success-bg text-status-success border-status-success/15' },
    pending: { label: 'Pending', classes: 'bg-status-warning/10 text-status-warning border-status-warning/15' },
    failed: { label: 'Failed', classes: 'bg-status-danger-bg text-status-danger border-status-danger/15' },
    not_started: { label: 'Not Started', classes: 'bg-surface-hover text-gray-400 border-card-border' },
  }[data.kyc_status] || { label: 'Not Started', classes: 'bg-surface-hover text-gray-400 border-card-border' };

  // ── Derived portfolio & financial figures (all from live data) ──
  const properties = data.properties || [];
  const letProps = properties.filter((p) => p.status === 'let');
  const vacantProps = properties.filter((p) => p.status === 'vacant');
  const onboardingProps = properties.filter((p) => p.status === 'onboarding');
  const rentRoll = letProps.reduce((s, p) => s + (parseFloat(p.rent_pcm) || 0), 0);
  const avgRent = letProps.length ? rentRoll / letProps.length : 0;

  const portfolioDonut = [
    { key: 'let', label: 'Let', value: letProps.length, color: PORTFOLIO_COLORS.let },
    { key: 'vacant', label: 'Vacant', value: vacantProps.length, color: PORTFOLIO_COLORS.vacant },
    { key: 'onboarding', label: 'Onboarding', value: onboardingProps.length, color: PORTFOLIO_COLORS.onboarding },
  ];

  const currentYear = new Date().getFullYear();
  const ytdIncome = transactions
    .filter((t) => t.type === 'rent_in' && new Date(t.transaction_date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const ytdExpenses = transactions
    .filter((t) => t.type !== 'rent_in' && t.type !== 'landlord_payout' && new Date(t.transaction_date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const netPaidYtd = statementsList
    .filter((s) => s.status === 'paid' && new Date(s.paid_at || s.generated_at || s.created_at).getFullYear() === currentYear)
    .reduce((sum, s) => sum + (parseFloat(s.net_paid) || 0), 0);
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
    .slice(0, 10);
  const typeLabel = (type) => (type || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Compliance % across this landlord's certificates
  const certsWithBucket = myCerts.map((c) => ({ ...c, bucket: certBucketOf(c) }));
  const compliantCount = certsWithBucket.filter((c) => c.bucket === 'compliant').length;
  const compliancePct = certsWithBucket.length ? Math.round((compliantCount / certsWithBucket.length) * 100) : null;

  // Outstanding actions — derived from live verification/compliance state
  const outstanding = [];
  if (data.kyc_status !== 'passed') outstanding.push({ label: 'KYC verification incomplete', severity: 'high', tab: 'settings' });
  if (!data.sanctions_checked) outstanding.push({ label: 'Sanctions check not completed', severity: 'medium', tab: 'settings' });
  if (data.tob_status !== 'signed') outstanding.push({ label: 'Terms of Business not signed', severity: 'high', tab: 'settings' });
  if (!data.ownership_confirmed) outstanding.push({ label: 'Ownership not confirmed', severity: 'medium', tab: 'settings' });
  if (!data.bank_name) outstanding.push({ label: 'No bank details recorded', severity: 'medium', tab: 'settings' });
  else if (data.change_pending || !data.verified_at) outstanding.push({ label: 'Bank details await verification', severity: 'high', tab: 'settings' });
  const expiredCerts = certsWithBucket.filter((c) => c.bucket === 'overdue').length;
  const dueSoonCerts = certsWithBucket.filter((c) => c.bucket === 'due_30').length;
  if (expiredCerts > 0) outstanding.push({ label: `${expiredCerts} certificate${expiredCerts > 1 ? 's' : ''} expired`, severity: 'high', tab: 'compliance' });
  if (dueSoonCerts > 0) outstanding.push({ label: `${dueSoonCerts} certificate${dueSoonCerts > 1 ? 's' : ''} expiring within 30 days`, severity: 'medium', tab: 'compliance' });
  if (pendingPayout > 0) outstanding.push({ label: `${money(pendingPayout)} in unpaid statements`, severity: 'medium', tab: 'statements' });

  const severityPill = {
    high: 'bg-status-danger-bg text-status-danger',
    medium: 'bg-status-warning/10 text-status-warning',
  };

  // This landlord's documents from the flattened folder tree.
  const landlordDocs = allDocs.filter(
    (d) => d.scope === 'landlord' && (d.entityId === data.landlord_reference || d.entityId === `LND-${id}`)
  );

  const statementStatusPill = {
    draft: 'bg-surface-hover text-gray-400',
    sent: 'bg-status-info-bg text-status-info',
    paid: 'bg-status-success-bg text-status-success',
  };

  const runQuickAction = (action) => {
    if (action === 'upload') fileInputRef.current?.click();
    else navigate(action);
  };
  const quickActions = [
    { label: 'Create Statement', icon: FileText, action: '/statements' },
    { label: 'Record Payment', icon: Banknote, action: '/accounting' },
    { label: 'Upload Document', icon: Upload, action: 'upload' },
    { label: 'Email Landlord', icon: Mail, href: `mailto:${data.email}` },
    { label: 'Maintenance', icon: Wrench, action: '/maintenance' },
    { label: 'Add Property', icon: Home, action: '/properties' },
  ];

  const lastLogin = relativeTime(data.last_login_at);

  return (
    <DetailContainer>
      {/* Hidden file input — reachable from Overview quick actions and Documents tab */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadFileChange}
      />

      <DetailHeader
        backPath="/landlords"
        backLabel="Back to Landlords"
        title={data.name}
        badge={
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wider uppercase ${kycBadge.classes}`}>
            {kycBadge.label}
          </span>
        }
        subtitle={[
          data.landlord_reference || `LND-${String(data.id).padStart(3, '0')}`,
          `Landlord since ${new Date(data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
          lastLogin ? `Last login: ${lastLogin}` : 'Never logged in',
          data.account_manager_name ? `Account Manager: ${data.account_manager_name}` : null,
        ].filter(Boolean).join(' • ')}
        editLabel="Edit Profile"
        onEdit={() => openEditModal()}
        onDelete={handleDelete}
      />

      {/* KPI strip (spec p.2) — Portfolio Value & client-account balance need
          modules that don't exist yet; Arrears and Net Paid are the honest stand-ins. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Monthly Rent Roll"
          value={money(rentRoll)}
          icon={PoundSterling}
          iconColor="text-status-success bg-status-success-bg"
          sub={<span className="text-gray-400">Across {letProps.length} let propert{letProps.length === 1 ? 'y' : 'ies'}</span>}
        />
        <StatCard
          label="Total Arrears"
          value={money(arrearsTotal)}
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor={arrearsTotal > 0 ? 'text-status-danger' : 'text-brand-primary'}
        />
        <StatCard
          label={`Net Paid (${currentYear})`}
          value={money(netPaidYtd)}
          icon={Wallet}
          iconColor="text-status-info bg-status-info-bg"
        />
        <StatCard
          label="Compliance"
          value={compliancePct !== null ? `${compliancePct}%` : '—'}
          icon={ShieldCheck}
          iconColor="text-status-success bg-status-success/10"
          sub={<span className="text-gray-400">{certsWithBucket.length} certificate{certsWithBucket.length === 1 ? '' : 's'}</span>}
        />
        <StatCard
          label="Outstanding Tasks"
          value={String(outstanding.length)}
          icon={ClipboardList}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor={outstanding.length > 0 ? 'text-status-danger' : 'text-brand-primary'}
          sub={outstanding.length > 0 ? <span className="text-status-danger">Requires attention</span> : <span className="text-status-success">All clear</span>}
        />
      </div>

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Portfolio Summary">
                {properties.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No properties managed yet.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <div className="relative w-[140px] h-[140px] shrink-0">
                      <PieChart width={140} height={140}>
                        <Pie
                          data={portfolioDonut.filter((s) => s.value > 0)}
                          dataKey="value"
                          innerRadius={48}
                          outerRadius={64}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {portfolioDonut.filter((s) => s.value > 0).map((s) => (
                            <Cell key={s.key} fill={s.color} />
                          ))}
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                        <span className="text-xl font-bold text-brand-primary leading-none">{properties.length}</span>
                        <span className="text-2xs text-gray-400 font-semibold mt-1">Propert{properties.length === 1 ? 'y' : 'ies'}</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-10">
                      <div>
                        <div className="flex items-center justify-between py-2 border-b border-card-border/60">
                          <span className="text-xs font-semibold text-gray-400">Monthly Rent Roll</span>
                          <span className="text-xs font-bold tabular-nums">{money(rentRoll)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-card-border/60">
                          <span className="text-xs font-semibold text-gray-400">Average Rent (pcm)</span>
                          <span className="text-xs font-bold tabular-nums">{money(avgRent)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-card-border/60 sm:border-0">
                          <span className="text-xs font-semibold text-gray-400">Vacant Units</span>
                          <span className="text-xs font-bold tabular-nums">
                            {vacantProps.length}{properties.length > 0 ? ` (${Math.round((vacantProps.length / properties.length) * 100)}%)` : ''}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between py-2 border-b border-card-border/60">
                          <span className="text-xs font-semibold text-gray-400">Total Arrears</span>
                          <span className={`text-xs font-bold tabular-nums ${arrearsTotal > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                            {money(arrearsTotal)}
                          </span>
                        </div>
                        {portfolioDonut.map((s) => (
                          <div key={s.key} className="flex items-center justify-between py-2 border-b border-card-border/60 last:border-0">
                            <span className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </span>
                            <span className="text-xs font-bold tabular-nums">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Properties Overview">
                <div className="flex flex-col gap-3">
                  {properties.length > 0 ? properties.map(p => (
                    <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between p-4 bg-gray-50/50 border border-card-border rounded-xl hover:border-brand-accent cursor-pointer transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <PropertyThumb imageId={p.primary_image_id} className="w-10 h-10 rounded-xl shrink-0" iconSize={20} />
                        <div className="min-w-0">
                          <h4 className="font-bold text-brand-primary group-hover:text-brand-accent transition-colors truncate">{p.name || p.address_line1}</h4>
                          <p className="text-xs font-semibold text-status-muted mt-0.5 truncate">
                            {p.property_reference || `Property #${p.id}`} • {p.city}, {p.postcode}
                            {p.rent_pcm ? ` • ${money(p.rent_pcm)} pcm` : ''}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={p.status} />
                    </div>
                  )) : <p className="text-sm text-gray-400 italic">No properties managed.</p>}
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title="Key Information">
                  <DataRow icon={Hash} label="Landlord ID" value={data.landlord_reference || `LND-${String(data.id).padStart(3, '0')}`} />
                  <DataRow icon={Mail} label="Email Address" value={data.email} />
                  <DataRow icon={Phone} label="Phone Number" value={data.phone} />
                  <DataRow icon={MapPin} label="Full Address" value={data.address} />
                  <DataRow icon={Building2} label="Company Name" value={data.company_name || '—'} />
                  <DataRow icon={Flag} label="Residency" value={data.is_overseas ? 'Overseas (NRL)' : 'United Kingdom'} />
                </Card>
                <Card title="Bank Details">
                  {data.bank_name ? (
                    <div className="space-y-1">
                      <div className="mb-3">
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
                      <p className="text-2xs text-gray-400 font-semibold pt-2">Manage under the Settings tab.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No bank details recorded — add them under Settings.</p>
                  )}
                </Card>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card title="Quick Actions">
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map(({ label, icon: Icon, action, href }) => {
                    const tileClass = "flex flex-col items-center gap-2 p-3.5 bg-surface-light/60 border border-card-border rounded-xl hover:border-brand-accent hover:bg-brand-accent/5 transition-colors cursor-pointer";
                    const inner = (
                      <>
                        <span className="w-9 h-9 rounded-xl bg-brand-accent/10 text-brand-accent flex items-center justify-center">
                          <Icon size={16} />
                        </span>
                        <span className="text-2xs font-bold text-brand-primary text-center leading-tight">{label}</span>
                      </>
                    );
                    return href ? (
                      <a key={label} href={href} className={tileClass}>{inner}</a>
                    ) : (
                      <button key={label} onClick={() => runQuickAction(action)} className={tileClass}>{inner}</button>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-card-border">
                  <p className="text-2xs font-bold text-gray-400 mb-2" style={{ textTransform: 'uppercase' }}>Account Manager</p>
                  {data.account_manager_name ? (
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                        {data.account_manager_name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-primary truncate">{data.account_manager_name}</p>
                        <p className="text-2xs text-gray-400 font-semibold truncate">{data.account_manager_email}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Not assigned — set one under Settings.</p>
                  )}
                </div>
              </Card>

              <Card title="Outstanding Actions">
                {outstanding.length === 0 ? (
                  <p className="flex items-center gap-2 text-xs font-bold text-status-success py-2">
                    <CheckCircle2 size={15} /> Nothing outstanding — all checks complete.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {outstanding.map((o, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveTab(o.tab)}
                        className="flex items-center justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0 text-left cursor-pointer hover:bg-surface-light/60 rounded-lg px-2 transition-colors"
                      >
                        <span className="text-xs font-semibold text-brand-primary min-w-0">{o.label}</span>
                        <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold shrink-0 ${severityPill[o.severity]}`}>
                          {o.severity === 'high' ? 'High' : 'Medium'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Recent Activity">
                {activity.length === 0 ? (
                  <p className="text-xs text-gray-400 font-semibold py-2">No recorded activity yet.</p>
                ) : (
                  <div className="flex flex-col">
                    {activity.slice(0, 5).map((act) => (
                      <div key={act.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            act.type === 'success' ? 'bg-status-success' : act.type === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-primary leading-tight truncate">{act.title}</p>
                            <p className="text-2xs text-gray-400 font-semibold mt-0.5 truncate">{act.desc}</p>
                          </div>
                        </div>
                        <span className="text-2xs font-bold text-gray-400 shrink-0">{act.time}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover pt-3 cursor-pointer text-center"
                    >
                      View full timeline
                    </button>
                  </div>
                )}
              </Card>

              <Card title="Notes">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={4}
                  placeholder="Internal notes about this landlord (not visible to them)…"
                  className="w-full bg-surface-light/60 border border-card-border rounded-card p-3 text-xs font-semibold text-brand-primary placeholder:text-gray-400 focus:outline-none focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/15 transition-all resize-y"
                />
                <div className="flex justify-end mt-3">
                  <Button variant="secondary" size="sm" onClick={handleSaveNotes} disabled={notesSaving || (notesDraft === (data.notes || ''))}>
                    {notesSaving ? 'Saving…' : 'Save Notes'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <StatCard label="Total Properties" value={String(properties.length)} icon={Building2} iconColor="text-brand-accent bg-brand-accent/10" />
              <StatCard label="Let" value={String(letProps.length)} icon={CheckCircle2} iconColor="text-status-success bg-status-success/10" />
              <StatCard label="Vacant" value={String(vacantProps.length)} icon={AlertTriangle} iconColor="text-status-warning bg-status-warning/10" />
              <StatCard label="Monthly Rent Roll" value={money(rentRoll)} icon={PoundSterling} iconColor="text-status-info bg-status-info-bg" />
              <StatCard label="Average Rent (pcm)" value={money(avgRent)} icon={TrendingUp} iconColor="text-brand-accent bg-brand-accent/10" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card title="Managed Properties">
                  <div className="flex flex-col gap-3">
                    {properties.length > 0 ? properties.map(p => (
                      <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between p-4 bg-gray-50/50 border border-card-border rounded-xl hover:border-brand-accent cursor-pointer transition-colors group">
                        <div className="flex items-center gap-4 min-w-0">
                          <PropertyThumb imageId={p.primary_image_id} className="w-10 h-10 rounded-xl shrink-0" iconSize={20} />
                          <div className="min-w-0">
                            <h4 className="font-bold text-brand-primary group-hover:text-brand-accent transition-colors truncate">{p.name || p.address_line1}</h4>
                            <p className="text-xs font-semibold text-status-muted mt-0.5 truncate">
                              {p.property_reference || `Property #${p.id}`} • {p.city}, {p.postcode} • {p.property_type}
                              {p.rent_pcm ? ` • ${money(p.rent_pcm)} pcm` : ''}
                            </p>
                          </div>
                        </div>
                        <StatusPill status={p.status} />
                      </div>
                    )) : <p className="text-sm text-gray-400 italic">No properties managed.</p>}
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-1">
                <Card title="Important Dates">
                  <DataRow icon={Calendar} label="Terms Signed" value={data.tob_signed_at ? new Date(data.tob_signed_at).toLocaleDateString('en-GB') : '—'} />
                  <DataRow icon={Clock} label="Account Created" value={new Date(data.created_at).toLocaleDateString('en-GB')} />
                  <DataRow icon={User} label="Last Login" value={lastLogin || 'Never'} />
                </Card>
              </div>
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
                    <p className="text-2xl font-bold text-status-success">{money(ytdIncome)}</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Fees & Costs</p>
                    <p className="text-2xl font-bold text-status-danger">{money(ytdExpenses)}</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pending Payout</p>
                    <p className="text-2xl font-bold text-brand-primary">{money(pendingPayout)}</p>
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
              <Card title="Recent Statements">
                {statementsList.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No statements generated yet.</p>
                ) : (
                  <div className="flex flex-col">
                    {statementsList.slice(0, 6).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-card-border/60 last:border-0">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-brand-primary truncate">
                            {fmtDate(s.period_start)} – {fmtDate(s.period_end)}
                          </p>
                          <p className="text-2xs text-gray-400 font-semibold mt-0.5">Net {money(s.net_paid)}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold shrink-0 ${statementStatusPill[s.status] || statementStatusPill.draft}`}>
                          {s.status === 'paid' ? 'Paid' : s.status === 'sent' ? 'Sent' : 'Draft'}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('statements')}
                      className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover pt-3 cursor-pointer text-center"
                    >
                      View all statements
                    </button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'statements' && (
          <Card title={`Statements (${statementsList.length})`}>
            <div className="flex justify-end mb-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/statements')}>
                Generate Statement
              </Button>
            </div>
            {statementsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 bg-surface-light rounded-card border border-dashed border-card-border">
                <FileText size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-status-muted">No statements for this landlord yet</p>
                <p className="text-xs text-gray-400 mt-1">Generate one from the Statements page.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-left border-b border-card-border">
                      <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Period</th>
                      <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider text-right">Gross Rent</th>
                      <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider text-right">Mgmt Fee</th>
                      <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider text-right">Net Paid</th>
                      <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Generated</th>
                      <th className="py-2 text-2xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementsList.map((s) => (
                      <tr key={s.id} className="border-b border-card-border/60 last:border-0">
                        <td className="py-2.5 pr-3 text-xs font-bold text-brand-primary whitespace-nowrap">
                          {fmtDate(s.period_start)} – {fmtDate(s.period_end)}
                        </td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-right tabular-nums">{money(s.gross_rent)}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-right tabular-nums">{money(s.mgmt_fee)}</td>
                        <td className="py-2.5 pr-3 text-xs font-bold text-right tabular-nums">{money(s.net_paid)}</td>
                        <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{fmtDate(s.generated_at)}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold ${statementStatusPill[s.status] || statementStatusPill.draft}`}>
                            {s.status === 'paid' ? 'Paid' : s.status === 'sent' ? 'Sent' : 'Draft'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title={`Property Certificates (${certsWithBucket.length})`}>
                {certsWithBucket.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    No certificates recorded for this landlord's properties yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead>
                        <tr className="text-left border-b border-card-border">
                          <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Certificate</th>
                          <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Property</th>
                          <th className="py-2 pr-3 text-2xs font-bold text-gray-400 uppercase tracking-wider">Expires</th>
                          <th className="py-2 text-2xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certsWithBucket.map((c) => (
                          <tr key={c.id} className="border-b border-card-border/60 last:border-0">
                            <td className="py-2.5 pr-3 text-xs font-bold text-brand-primary whitespace-nowrap">{c.cert_type}</td>
                            <td className="py-2.5 pr-3 text-xs font-semibold text-gray-400">{c.property_address}</td>
                            <td className="py-2.5 pr-3 text-xs font-semibold whitespace-nowrap">
                              {fmtDate(c.expires_at)}
                              {c.days_left !== null && (
                                <span className={`block text-2xs font-bold ${c.days_left < 0 ? 'text-status-danger' : c.days_left <= 30 ? 'text-status-warning' : 'text-gray-400'}`}>
                                  {c.days_left < 0 ? `${Math.abs(c.days_left)} days ago` : `${c.days_left} days`}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5">
                              <span className={`px-2 py-0.5 rounded-sm text-2xs font-bold whitespace-nowrap ${CERT_BUCKETS[c.bucket].pill}`}>
                                {CERT_BUCKETS[c.bucket].label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Landlord Verification">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${
                    isVerified ? 'bg-status-success-bg text-status-success' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {isVerified ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-brand-primary font-bold text-lg">{kycBadge.label}</h4>
                    <p className="text-xs text-status-muted mt-1 leading-relaxed">
                      KYC via {data.kyc_provider || 'HIPLA'}{data.kyc_ref ? ` • Ref ${data.kyc_ref}` : ''}
                    </p>
                  </div>
                </div>
                <DataRow icon={ShieldCheck} label="Sanctions Check" value={data.sanctions_checked ? 'Completed' : 'Not completed'} />
                <DataRow
                  icon={FileText}
                  label="Terms of Business"
                  value={
                    data.tob_status === 'signed'
                      ? `Signed${data.tob_signed_at ? ` on ${new Date(data.tob_signed_at).toLocaleDateString('en-GB')}` : ''}`
                      : data.tob_status === 'sent' ? 'Sent' : 'Not Sent'
                  }
                />
                <DataRow icon={CheckCircle2} label="Ownership Confirmed" value={data.ownership_confirmed ? 'Yes' : 'No'} />
                <DataRow icon={Flag} label="NRL Number (HMRC)" value={data.nrl_hmrc_ref || '—'} />
                <DataRow icon={Hash} label="NRL Withholding" value={data.nrl_withhold_pct != null ? `${data.nrl_withhold_pct}%` : '—'} />
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-2xs font-bold text-brand-accent hover:text-brand-accent-hover pt-3 cursor-pointer"
                >
                  Manage verification under Settings
                </button>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Uploaded Documents">
                {landlordDocs.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload Document
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
                      className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm cursor-pointer"
                    >
                      Upload Document
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

        {activeTab === 'timeline' && (
          <Card title="Timeline">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                <Clock size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-status-muted">No recorded activity yet</p>
                <p className="text-xs text-gray-400 mt-1">Actions on this landlord, their properties and tenancies appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {activity.map((act) => (
                  <div key={act.id} className="flex items-start gap-4 py-3.5 border-b border-card-border/60 last:border-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                      act.type === 'success' ? 'bg-status-success' : act.type === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-brand-primary leading-tight">{act.title}</p>
                        <span className="text-2xs font-bold text-gray-400 shrink-0">{act.time}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-semibold mt-1">
                        {act.desc}{act.date ? ` • ${fmtDate(act.date)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card title="Verification Status">
                <form onSubmit={handleKycSubmit} className="flex flex-col gap-3">
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
                  <Dropdown
                    label="Sanctions Check"
                    id="sanctions-checked"
                    options={[
                      { value: 'no', label: 'Not Completed' },
                      { value: 'yes', label: 'Completed' },
                    ]}
                    value={kycForm.sanctions_checked}
                    onChange={(val) => setKycForm(f => ({ ...f, sanctions_checked: val }))}
                  />
                  <Button type="submit" variant="primary" disabled={kycSaving}>
                    {kycSaving ? 'Saving…' : 'Update KYC Status'}
                  </Button>
                </form>

                {/* Ownership confirmation — an explicit admin decision, separate from KYC */}
                <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-brand-primary">Ownership Confirmed</p>
                    <p className="text-2xs text-status-muted mt-0.5">
                      {data.ownership_confirmed ? 'Confirmed by administrator' : 'Not yet confirmed'}
                    </p>
                  </div>
                  <Button variant={data.ownership_confirmed ? 'ghost' : 'primary'} onClick={handleToggleOwnership}>
                    {data.ownership_confirmed ? 'Revoke' : 'Confirm'}
                  </Button>
                </div>

                {/* Portal access — a fresh link invalidates any previous one */}
                <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-brand-primary">Portal Access</p>
                    <p className="text-2xs text-status-muted mt-0.5">
                      One-time set-password link to share with the landlord
                    </p>
                  </div>
                  <Button variant="ghost" onClick={handleGenerateActivationLink} disabled={activationLoading}>
                    {activationLoading ? 'Generating…' : 'Generate Link'}
                  </Button>
                </div>
              </Card>

              <Card title="Account Manager">
                <p className="text-2xs text-status-muted mb-3">
                  The staff member responsible for this landlord relationship.
                </p>
                <Dropdown
                  id="account-manager"
                  placeholder="Not assigned"
                  clearable
                  options={managers.map((m) => ({ value: String(m.id), label: m.name }))}
                  value={managerSel}
                  onChange={(val) => setManagerSel(val || '')}
                />
                <div className="flex justify-end mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveManager}
                    disabled={managerSaving || managerSel === (data.account_manager_id ? String(data.account_manager_id) : '')}
                  >
                    {managerSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-6">
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

            <div className="lg:col-span-1 space-y-6">
              <Card title="Tax & Terms">
                <DataRow
                  icon={FileText}
                  label="Terms of Business"
                  value={
                    data.tob_status === 'signed'
                      ? `Signed${data.tob_signed_at ? ` on ${new Date(data.tob_signed_at).toLocaleDateString('en-GB')}` : ''}`
                      : data.tob_status === 'sent' ? 'Sent' : 'Not Sent'
                  }
                />
                <DataRow icon={Hash} label="Statement Initials" value={data.initials || '—'} />
                <DataRow icon={Hash} label="Ownership Share" value={data.ownership_share != null ? `${data.ownership_share}%` : '—'} />
                <DataRow icon={Flag} label="NRL Number (HMRC)" value={data.nrl_hmrc_ref || '—'} />
                <DataRow icon={CheckCircle2} label="NRL HMRC Approved" value={data.nrl_hmrc_approved ? 'Yes' : 'No'} />
                <DataRow icon={Hash} label="NRL Withholding" value={data.nrl_withhold_pct != null ? `${data.nrl_withhold_pct}%` : '—'} />
                <p className="text-2xs text-gray-400 font-semibold pt-2">
                  Edit these via “Edit Profile” in the page header.
                </p>
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
                  placeholder="e.g. 07123 456789"
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
                placeholder="e.g. Barclays"
                value={bankForm.bank_name}
                error={bankErrors.bank_name}
                onChange={handleBankChange('bank_name')}
              />
              <Input
                label="Account Name"
                id="account_name"
                required
                placeholder="Name on the account"
                value={bankForm.account_name}
                error={bankErrors.account_name}
                onChange={handleBankChange('account_name')}
              />
              <Input
                label="Account Number"
                id="account_number"
                required
                placeholder="e.g. 12345678"
                value={bankForm.account_number}
                error={bankErrors.account_number}
                onChange={handleBankChange('account_number')}
              />
              <Input
                label="Sort Code"
                id="sort_code"
                required
                placeholder="e.g. 12-34-56"
                value={bankForm.sort_code}
                error={bankErrors.sort_code}
                onChange={handleBankChange('sort_code')}
              />
              <Input
                label="IBAN / BIC (optional)"
                id="iban_bic"
                placeholder="e.g. GB29NWBK60161331926819"
                value={bankForm.iban_bic}
                error={bankErrors.iban_bic}
                onChange={handleBankChange('iban_bic')}
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

      <ActivationLinkModal info={activationInfo} onClose={() => setActivationInfo(null)} />

      <DocumentUploadModal
        file={pendingUpload}
        scope="landlord"
        entityId={id}
        onClose={() => setPendingUpload(null)}
        onUploaded={() => {
          setPendingUpload(null);
          setDocsReloadKey((k) => k + 1);
        }}
      />
    </DetailContainer>
  );
};
