import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Briefcase, Building2, Eye, Home, ShieldCheck, 
  Mail, Phone, Clock, Users, Hash
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import api from '../utilities/api';

const statusColors = {
  active: 'bg-status-success/10 text-status-success border-status-success/20',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-status-danger/10 text-status-danger border-status-danger/20',
};

export const AgentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await api.get(`/agents/${id}`);
        setData(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load agent', 'error');
        navigate('/agents');
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
  }, [id, navigate, addToast]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Letting Agent',
      message: `Are you sure you want to delete ${data.company_name}? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Agent',
    });
    
    if (ok) {
      try {
        await api.delete(`/agents/${id}`);
        addToast('Agent deleted successfully', 'success');
        navigate('/agents');
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete agent', 'error');
      }
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Briefcase },
    { id: 'instructions', label: 'Instructions', icon: Home },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck }
  ];

  const activeCount = data.instructions?.filter(i => i.status === 'active').length || 0;

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/agents"
        backLabel="Back to Letting Agents"
        title={data.company_name}
        badge={
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border tracking-wide uppercase ${
            data.status === 'active' ? 'bg-status-success/10 text-status-success border-status-success/20' : 'bg-status-danger/10 text-status-danger border-status-danger/20'
          }`}>
            {data.status}
          </span>
        }
        subtitle={`AGENCY • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Profile"
        onDelete={handleDelete}
      />

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Agency Summary">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={Building2} label="Company Name" value={data.company_name} />
                    <DataRow icon={Users} label="Contact Person" value={data.contact_name} />
                  </div>
                  <div>
                    <DataRow icon={Mail} label="Email Address" value={data.email} />
                    <DataRow icon={Phone} label="Phone Number" value={data.phone} />
                  </div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Activity Stats">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Instructions', value: data.instructions?.length || 0 },
                    { label: 'Active Instructions', value: activeCount, color: 'text-status-success' },
                    { label: 'Completed', value: data.instructions?.filter(i => i.status === 'completed').length || 0 },
                    { label: 'Total Viewings', value: data.instructions?.reduce((sum, i) => sum + (i.viewings_count || 0), 0) || 0, color: 'text-brand-accent' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                      <p className={`text-2xl font-bold ${stat.color || 'text-[#1A1A1A]'}`}>{stat.value}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'instructions' && (
          <div className="grid grid-cols-1 gap-6">
            <Card title={`Instructions (${data.instructions?.length || 0})`}>
              {data.instructions?.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {['Property', 'Landlord', 'Marketing Rent', 'Fee', 'Viewings', 'Status', 'Instructed'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.instructions.map(ins => (
                        <tr key={ins.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
                          <td className="py-3 px-4">
                            <p className="font-bold text-[#1A1A1A]">{ins.property_address}</p>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{ins.landlord_name}</td>
                          <td className="py-3 px-4 font-bold text-[#1A1A1A]">{ins.marketing_rent ? `£${parseFloat(ins.marketing_rent).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</td>
                          <td className="py-3 px-4 text-gray-600">{ins.agent_fee_amount ? `£${ins.agent_fee_amount}` : '—'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">{ins.viewings_count}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusColors[ins.status] || statusColors.active}`}>
                              {ins.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{ins.instructed_at ? new Date(ins.instructed_at).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Home size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No instructions recorded</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Compliance Details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={ShieldCheck} label="Redress Scheme" value={data.redress_scheme} />
                  </div>
                  <div>
                    <DataRow icon={ShieldCheck} label="CMP Provider" value={data.cmp_provider} />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DetailContainer>
  );
};
