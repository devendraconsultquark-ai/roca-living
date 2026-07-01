import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, ShieldCheck, Users, Wrench, FileText, Clock, Building2, MapPin, Hash, Key, Receipt
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { StatusPill } from '../components/UI/StatusPill';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs, CertBadge, urgencyColor } from '../components/UI/DetailComponents';
import api from '../utilities/api';

export const PropertyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
  }, [id, navigate, addToast]);

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
        title={data.address_line1}
        badge={<StatusPill status={data.status === 'let' ? 'active' : data.status === 'vacant' ? 'pending' : 'draft'} />}
        subtitle={`${data.city} ${data.postcode} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Property"
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
                    <DataRow icon={Home} label="Bedrooms" value={`${data.bedrooms} Bed`} />
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
                  <div className="mt-6 bg-gray-50 rounded-xl p-4 text-sm text-gray-600 border border-gray-100">
                    <p className="font-semibold text-gray-700 mb-1">Notes</p>
                    {data.notes}
                  </div>
                )}
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Quick Status">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-500">Current Occupancy</span>
                    <span className="text-sm font-bold text-[#1A1A1A]">{data.status === 'let' ? 'Occupied' : 'Vacant'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-500">Active Tickets</span>
                    <span className="text-sm font-bold text-[#1A1A1A]">{data.maintenance_tickets?.filter(t => t.status !== 'completed').length || 0}</span>
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
                      <h4 className="font-bold text-[#1A1A1A] mb-3">Tenants</h4>
                      <div className="flex flex-col gap-2">
                        {data.active_tenancy.tenants?.map(t => (
                          <div key={t.id}
                            onClick={() => navigate(`/tenants/${t.id}`)}
                            className="flex items-center justify-between bg-gray-50 border border-border-color/30 rounded-xl px-4 py-3 cursor-pointer hover:border-brand-accent transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                <Users size={14} />
                              </div>
                              <span className="text-sm font-bold text-[#1A1A1A]">{t.name}</span>
                            </div>
                            {t.is_lead_tenant && <span className="text-[10px] uppercase font-bold bg-brand-accent/10 text-brand-accent px-2 py-1 rounded-md">Lead Tenant</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Users size={32} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No active tenancy</p>
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
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/50 border border-border-color rounded-xl p-4 gap-4 hover:border-brand-accent transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                          <Wrench size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1A1A1A]">{t.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Reported: {t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${urgencyColor[t.urgency] || urgencyColor.routine}`}>
                          {t.urgency}
                        </span>
                        <span className="text-[10px] font-bold bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {t.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <Wrench size={32} className="text-gray-300 mb-3" />
                      <p className="text-sm font-semibold text-gray-500">No maintenance tickets</p>
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
                    <div key={cert.id} className="flex items-center justify-between bg-white border border-border-color rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1A1A1A]">{cert.cert_type}</p>
                          {cert.expires_at ? (
                            <p className="text-xs font-semibold text-gray-500 mt-0.5">Expires: {new Date(cert.expires_at).toLocaleDateString('en-GB')}</p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">No expiry date set</p>
                          )}
                        </div>
                      </div>
                      <CertBadge status={cert.status} />
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
                      <span className="text-[13px] font-semibold text-gray-600">{item.item_label}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'complete'
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-status-warning/10 text-status-warning'
                      }`}>
                        {item.status}
                      </span>
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
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <FileText size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">No documents uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">Leases, floor plans, and instructions will appear here.</p>
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
