import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash, Mail, Phone, Globe, MapPin,
  Building2, Flag, Calendar, ShieldCheck, Banknote, Home,
  CheckCircle2, AlertTriangle, Clock, FileText, User
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
                    <DataRow icon={Globe} label="Nationality" value="—" />
                    <DataRow icon={MapPin} label="Full Address" value={data.address} />
                  </div>
                  <div>
                    <DataRow icon={Building2} label="Ownership Type" value={data.is_overseas ? 'Overseas' : 'Personal'} />
                    <DataRow icon={Flag} label="Country" value="United Kingdom" />
                    <DataRow icon={Hash} label="Postcode" value="—" />
                    <DataRow icon={Calendar} label="Date Of Birth" value="—" />
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
                    <p className="text-2xl font-bold text-brand-primary">£0.00</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Expenses</p>
                    <p className="text-2xl font-bold text-brand-primary">£0.00</p>
                  </div>
                  <div className="bg-surface-light p-4 rounded-card border border-card-border">
                    <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pending Payout</p>
                    <p className="text-2xl font-bold text-brand-primary">£0.00</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-brand-primary">Recent Transactions</h4>
                  <button className="text-xs font-bold text-brand-accent hover:underline">View All</button>
                </div>
                <div className="flex flex-col items-center justify-center p-8 bg-surface-light rounded-card border border-dashed border-card-border">
                  <Banknote size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No transactions found</p>
                  <p className="text-xs text-gray-400 mt-1">Rent payments and payouts will appear here.</p>
                </div>
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
                <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-card border border-dashed border-card-border">
                  <FileText size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No documents uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">Contracts, IDs, and agreements will appear here.</p>
                  <button className="mt-4 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-brand-primary hover:bg-surface-hover transition-colors shadow-sm">
                    Upload Document
                  </button>
                </div>
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

      {/* Update Bank Details Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
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

