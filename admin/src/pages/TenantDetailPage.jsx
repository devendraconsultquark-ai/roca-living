import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, ShieldCheck, 
  Home, CreditCard, Clock, AlertTriangle, Hash, Calendar, FileText
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
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
  }, [id, navigate, addToast]);

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
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border tracking-wide uppercase ${
            balance < 0 ? 'bg-status-danger/10 text-status-danger border-status-danger/20' : 'bg-status-success/10 text-status-success border-status-success/20'
          }`}>
            Balance: {balance < 0 ? `-£${Math.abs(balance).toFixed(2)}` : `£${balance.toFixed(2)}`}
          </span>
        }
        subtitle={`${data.is_lead_tenant ? 'LEAD TENANT' : 'CO-TENANT'} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Profile"
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
                    data.right_to_rent_status === 'verified' ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {data.right_to_rent_status === 'verified' ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-[#1A1A1A] font-bold text-lg capitalize">{data.right_to_rent_status || 'Pending'}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
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
                  <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Home size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No active tenancy</p>
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
                        className="flex items-center justify-between bg-gray-50 hover:border-brand-accent border border-border-color/30 rounded-xl px-4 py-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                            <Users size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#1A1A1A]">{t.name}</p>
                          </div>
                        </div>
                        {t.is_lead_tenant ? <span className="text-[10px] uppercase font-bold bg-brand-accent/10 text-brand-accent px-2 py-1 rounded-md">Lead</span> : null}
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
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Date</th>
                        <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Amount</th>
                        <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Method</th>
                        <th className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payment_history.map(p => (
                        <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-gray-600 font-medium">{p.received_at ? new Date(p.received_at).toLocaleDateString('en-GB') : '—'}</td>
                          <td className="py-3 px-4 font-bold text-[#1A1A1A]">£{parseFloat(p.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-gray-600">{methodLabel[p.method] || p.method}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs font-mono">{p.reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <CreditCard size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No payment history</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Tenant Documents">
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <FileText size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No documents uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">IDs, references, and agreements will appear here.</p>
                  <button className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-sm">
                    Upload Document
                  </button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DetailContainer>
  );
};
