import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserCog, Wrench, AlertTriangle, CheckCircle2, Clock, Mail, Phone, Star, Building2, ShieldCheck, MapPin, Calendar, X
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs, urgencyColor, ticketStatusIcon } from '../components/UI/DetailComponents';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import api from '../utilities/api';

export const ContractorDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [reloadKey, setReloadKey] = useState(0);

  // Edit Contractor modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', contact_name: '', trade: '', email: '', phone: '', insurance_expiry: '', rating: '', preferred: 'no', status: 'active' });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const fetchContractor = async () => {
      try {
        const res = await api.get(`/maintenance/contractors/${id}`);
        setData(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load contractor', 'error');
        navigate('/contractors');
      } finally {
        setLoading(false);
      }
    };
    fetchContractor();
  }, [id, navigate, addToast, reloadKey]);

  const handleEditClick = () => {
    setEditForm({
      company_name: data.company_name || '',
      contact_name: data.contact_name || '',
      trade: data.trade || '',
      email: data.email || '',
      phone: data.phone || '',
      insurance_expiry: data.insurance_expiry ? data.insurance_expiry.split('T')[0] : '',
      rating: data.rating != null ? String(data.rating) : '',
      preferred: data.preferred ? 'yes' : 'no',
      status: data.status || 'active'
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.company_name.trim()) errs.company_name = 'Company name is required';
    if (!editForm.trade.trim()) errs.trade = 'Trade is required';
    if (Object.keys(errs).length > 0) { setEditFormErrors(errs); return; }

    setEditFormErrors({});
    setEditSaving(true);
    try {
      await api.patch(`/maintenance/contractors/${id}`, {
        ...editForm,
        rating: editForm.rating !== '' ? parseFloat(editForm.rating) : undefined,
        preferred: editForm.preferred === 'yes'
      });
      addToast('Contractor updated successfully!', 'success');
      setIsEditModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update contractor', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Contractor',
      message: `Are you sure you want to delete ${data.company_name}? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Contractor',
    });
    
    if (ok) {
      try {
        await api.delete(`/maintenance/contractors/${id}`);
        addToast('Contractor deleted successfully', 'success');
        navigate('/contractors');
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to delete contractor', 'error');
      }
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: UserCog },
    { id: 'jobs', label: 'Assigned Jobs', icon: Wrench },
    { id: 'compliance', label: 'Compliance & Insurance', icon: ShieldCheck }
  ];

  const isInsuranceExpired = data.insurance_expiry && new Date(data.insurance_expiry) < new Date();
  const totalJobs = data.tickets?.length || 0;
  const completedJobs = data.tickets?.filter(t => t.status === 'complete').length || 0;

  return (
    <DetailContainer>
      <DetailHeader
        backPath="/contractors"
        backLabel="Back to Contractors"
        title={data.company_name}
        badge={
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wide uppercase ${
            data.status === 'active' ? 'bg-status-success-bg text-status-success border-status-success/15' : 'bg-status-danger-bg text-status-danger border-status-danger/15'
          }`}>
            {data.status}
          </span>
        }
        subtitle={`${data.trade} • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Contractor"
        onEdit={handleEditClick}
        onDelete={handleDelete}
      />

      <DetailTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Contractor Summary">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
                  <div>
                    <DataRow icon={Building2} label="Company Name" value={data.company_name} />
                    <DataRow icon={Wrench} label="Trade Specialty" value={data.trade} />
                    <DataRow icon={Star} label="Rating" value={data.rating ? `${data.rating} ★` : null} />
                  </div>
                  <div>
                    <DataRow icon={Mail} label="Email Address" value={data.email} />
                    <DataRow icon={Phone} label="Phone Number" value={data.phone} />
                  </div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <Card title="Performance Stats">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Jobs', value: totalJobs },
                    { label: 'Completed', value: completedJobs, color: 'text-status-success' },
                    { label: 'In Progress', value: data.tickets?.filter(t => t.status === 'in_progress').length || 0, color: 'text-status-warning' },
                    { label: 'Cancelled', value: data.tickets?.filter(t => t.status === 'cancelled').length || 0, color: 'text-status-danger' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-surface-light border border-card-border rounded-xl p-4 flex flex-col justify-center items-center text-center">
                      <p className={`text-2xl font-bold ${stat.color || 'text-brand-primary'}`}>{stat.value}</p>
                      <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="grid grid-cols-1 gap-6">
            <Card title={`Assigned Jobs (${totalJobs})`}>
              {data.tickets?.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-card-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                        {['Job', 'Property', 'Urgency', 'Quote', 'Status', 'Date'].map(h => (
                          <th key={h} className="text-left py-3 px-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs-portal">
                      {data.tickets.map(t => (
                        <tr key={t.id} className="hover:bg-surface-light/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-brand-primary max-w-[200px] truncate">{t.title}</td>
                          <td className="py-3 px-4 text-status-muted text-xs">{t.property_address}</td>
                          <td className="py-3 px-4">
                            <span className={`text-2xs font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider ${urgencyColor[t.urgency] || urgencyColor.routine}`}>
                              {t.urgency}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-brand-primary">{t.quote_amount ? `£${parseFloat(t.quote_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1.5 text-2xs font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider w-fit bg-surface-hover text-gray-400 border-card-border">
                              {ticketStatusIcon[t.status] || <Clock size={13} className="text-gray-400" />}
                              {t.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs font-semibold">{t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-xl border border-dashed border-card-border">
                  <Wrench size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No jobs assigned</p>
                  <p className="text-xs text-gray-400 mt-1">Maintenance jobs will appear here once assigned.</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Insurance Details">
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-4 p-4 bg-surface-light border border-card-border rounded-xl">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 ${
                      isInsuranceExpired ? 'bg-status-danger-bg text-status-danger' : 'bg-status-success-bg text-status-success'
                    }`}>
                      {isInsuranceExpired ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    <div>
                      <h4 className="text-brand-primary font-bold text-lg">{isInsuranceExpired ? 'Insurance Expired' : 'Insurance Valid'}</h4>
                      <p className="text-xs text-status-muted mt-1 leading-relaxed">
                        {data.insurance_expiry ? `Expiry Date: ${new Date(data.insurance_expiry).toLocaleDateString('en-GB')}` : 'No insurance date provided'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-y-1">
                    <DataRow icon={Calendar} label="Policy Expiration" value={data.insurance_expiry ? new Date(data.insurance_expiry).toLocaleDateString('en-GB') : '—'} />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Contractor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Edit Contractor Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Company Name"
                  id="edit-c-company"
                  required
                  value={editForm.company_name}
                  onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                  error={editFormErrors.company_name}
                />
                <Input
                  label="Contact Name"
                  id="edit-c-contact"
                  placeholder="e.g. Dave Miller"
                  value={editForm.contact_name}
                  onChange={(e) => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                />
                <Input
                  label="Trade Specialty"
                  id="edit-c-trade"
                  required
                  placeholder="e.g. Plumbing & Leaks"
                  value={editForm.trade}
                  onChange={(e) => setEditForm(f => ({ ...f, trade: e.target.value }))}
                  error={editFormErrors.trade}
                />
                <Input
                  label="Email Address"
                  id="edit-c-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
                <Input
                  label="Phone Number"
                  id="edit-c-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
                <Input
                  label="Insurance Expiry Date"
                  id="edit-c-insurance"
                  type="date"
                  value={editForm.insurance_expiry}
                  onChange={(e) => setEditForm(f => ({ ...f, insurance_expiry: e.target.value }))}
                />
                <Input
                  label="Rating (0-5)"
                  id="edit-c-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="e.g. 4.5"
                  value={editForm.rating}
                  onChange={(e) => setEditForm(f => ({ ...f, rating: e.target.value }))}
                />
                <Dropdown
                  label="Preferred Contractor"
                  id="edit-c-preferred"
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' }
                  ]}
                  value={editForm.preferred}
                  onChange={(val) => setEditForm(f => ({ ...f, preferred: val }))}
                />
                <Dropdown
                  label="Contractor Status"
                  id="edit-c-status"
                  placeholder="Select status"
                  value={editForm.status}
                  onChange={(val) => setEditForm(f => ({ ...f, status: val }))}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'suspended', label: 'Suspended / Inactive' }
                  ]}
                />
              </div>

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditFormErrors({}); }} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailContainer>
  );
};
