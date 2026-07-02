import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash, Mail, Phone, Globe, MapPin, 
  Building2, Flag, Calendar, ShieldCheck, Banknote, Home, 
  CheckCircle2, AlertTriangle, Clock, FileText, Users, Briefcase
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import {StatusPill} from "../components/UI/StatusPill"
import api from '../utilities/api';


export const LandlordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchLandlord = async () => {
      try {
        const res = await api.get(`/landlords/${id}`);
        setData(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load landlord', 'error');
        navigate('/landlords');
      } finally {
        setLoading(false);
      }
    };
    fetchLandlord();
  }, [id, navigate, addToast]);

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
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border tracking-wide uppercase ${
            isVerified ? 'bg-status-success/10 text-status-success border-status-success/20' :
            data.kyc_status === 'pending' ? 'bg-status-warning/10 text-status-warning border-status-warning/20' :
            'bg-status-danger/10 text-status-danger border-status-danger/20'
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
                    isVerified ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {isVerified ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-[#1A1A1A] font-bold text-lg">{isVerified ? 'Verified' : 'Pending'}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {isVerified ? `Verified on ${data.tob_signed_at ? new Date(data.tob_signed_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}` : 'Awaiting verification'}
                      <br/>
                      {isVerified ? 'by Administrator' : ''}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Managed Properties">
                <p className="text-sm font-semibold text-gray-500 mb-4">{data.properties?.length || 0} Property{data.properties?.length !== 1 ? 'ies' : ''}</p>
                <div className="flex flex-col gap-3">
                  {data.properties?.length > 0 ? data.properties.map(p => (
                    <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between p-4 bg-gray-50/50 border border-border-color rounded-xl hover:border-brand-accent cursor-pointer transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary">
                          <Home size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#1A1A1A] group-hover:text-brand-accent transition-colors">{p.name || p.address_line1}</h4>
                          <p className="text-xs font-semibold text-gray-500 mt-0.5">{p.property_reference || `Property #${p.id}`} • {p.city}, {p.postcode} • {p.property_type}</p>
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
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Income</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">£0.00</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">YTD Expenses</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">£0.00</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pending Payout</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">£0.00</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-[#1A1A1A]">Recent Transactions</h4>
                  <button className="text-xs font-bold text-brand-accent hover:underline">View All</button>
                </div>
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Banknote size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No transactions found</p>
                  <p className="text-xs text-gray-400 mt-1">Rent payments and payouts will appear here.</p>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Card title="Bank Details">
                {data.bank_name ? (
                  <div className="space-y-1">
                    <DataRow icon={Banknote} label="Bank Name" value={data.bank_name} />
                    <DataRow icon={User} label="Account Name" value={data.account_name} />
                    <DataRow icon={Hash} label="Account No." value={data.account_number ? `****${String(data.account_number).slice(-4)}` : '—'} />
                    <DataRow icon={Hash} label="Sort Code" value={data.sort_code} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No bank details recorded.</p>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Uploaded Documents">
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <FileText size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No documents uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">Contracts, IDs, and agreements will appear here.</p>
                  <button className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-sm">
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
                      <span className="text-[13px] font-semibold text-gray-600">{item.item_label}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'complete' ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'
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
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Mail size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No recent communications</p>
                  <p className="text-xs text-gray-400 mt-1">Emails and automated messages sent to this landlord will appear here.</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DetailContainer>
  );
};

