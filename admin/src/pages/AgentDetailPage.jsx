import { Fragment, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase, Building2, Home, ShieldCheck,
  Mail, Phone, Users, X, Plus, CalendarPlus
} from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { DataRow, Card, DetailContainer, DetailSkeleton, DetailHeader, DetailTabs } from '../components/UI/DetailComponents';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import api from '../utilities/api';

const statusColors = {
  active: 'bg-status-success-bg text-status-success border-status-success/15',
  completed: 'bg-surface-hover text-gray-400 border-card-border',
  cancelled: 'bg-status-danger-bg text-status-danger border-status-danger/15',
};

export const AgentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [reloadKey, setReloadKey] = useState(0);

  // Edit Profile modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    redress_scheme: '',
    cmp_provider: '',
    status: 'active',
  });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // New Instruction modal
  const emptyInstruction = {
    property_id: '',
    agency_basis: '',
    agent_fee_basis: 'percentage',
    agent_fee_amount: '',
    roca_letting_fee: '',
    marketing_rent: '',
  };
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  const [instructionForm, setInstructionForm] = useState(emptyInstruction);
  const [propertiesList, setPropertiesList] = useState([]);
  const [instructionSaving, setInstructionSaving] = useState(false);

  // Log Viewing modal — holds the target instruction or null
  const emptyViewing = { viewed_at: '', applicant_name: '', applicant_ref: '', outcome: '', feedback: '' };
  const [viewingTarget, setViewingTarget] = useState(null);
  const [viewingForm, setViewingForm] = useState(emptyViewing);
  const [viewingSaving, setViewingSaving] = useState(false);

  // Expanded viewings per instruction id
  const [expandedViewings, setExpandedViewings] = useState({});

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
  }, [id, navigate, addToast, reloadKey]);

  useEffect(() => {
    api.get('/properties').then((res) => {
      setPropertiesList((res.data.data || []).map((p) => ({
        value: p.id,
        label: `${p.address_line1}, ${p.city}`,
      })));
    }).catch(() => { /* dropdown stays empty */ });
  }, []);

  const handleInstructionSubmit = async (e) => {
    e.preventDefault();
    if (!instructionForm.property_id) {
      addToast('Select a property for the instruction', 'warning');
      return;
    }
    setInstructionSaving(true);
    try {
      await api.post(`/agents/${id}/instructions`, {
        property_id: instructionForm.property_id,
        agency_basis: instructionForm.agency_basis || undefined,
        agent_fee_basis: instructionForm.agent_fee_basis,
        agent_fee_amount: instructionForm.agent_fee_amount !== '' ? parseFloat(instructionForm.agent_fee_amount) : undefined,
        roca_letting_fee: instructionForm.roca_letting_fee !== '' ? parseFloat(instructionForm.roca_letting_fee) : undefined,
        marketing_rent: instructionForm.marketing_rent !== '' ? parseFloat(instructionForm.marketing_rent) : undefined,
      });
      addToast('Instruction created', 'success');
      setIsInstructionModalOpen(false);
      setInstructionForm(emptyInstruction);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create instruction', 'error');
    } finally {
      setInstructionSaving(false);
    }
  };

  const handleInstructionStatus = async (ins, status) => {
    const ok = await confirm({
      title: status === 'completed' ? 'Complete Instruction' : 'Cancel Instruction',
      message: `Mark the instruction for ${ins.property_address} as ${status}? This cannot be undone.`,
      variant: status === 'cancelled' ? 'danger' : undefined,
      confirmText: status === 'completed' ? 'Mark Completed' : 'Cancel Instruction',
    });
    if (!ok) return;
    try {
      await api.patch(`/agents/instructions/${ins.id}`, { status });
      addToast(`Instruction ${status}`, 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update instruction', 'error');
    }
  };

  const handleViewingSubmit = async (e) => {
    e.preventDefault();
    if (!viewingForm.viewed_at) {
      addToast('Viewing date/time is required', 'warning');
      return;
    }
    setViewingSaving(true);
    try {
      await api.post(`/agents/instructions/${viewingTarget.id}/viewings`, {
        viewed_at: viewingForm.viewed_at,
        applicant_name: viewingForm.applicant_name || undefined,
        applicant_ref: viewingForm.applicant_ref || undefined,
        outcome: viewingForm.outcome || undefined,
        feedback: viewingForm.feedback || undefined,
      });
      addToast('Viewing logged', 'success');
      setViewingTarget(null);
      setViewingForm(emptyViewing);
      // Refresh the expanded list if open, and the counts
      setExpandedViewings((prev) => ({ ...prev, [viewingTarget.id]: undefined }));
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to log viewing', 'error');
    } finally {
      setViewingSaving(false);
    }
  };

  const toggleViewings = async (ins) => {
    if (expandedViewings[ins.id]) {
      setExpandedViewings((prev) => ({ ...prev, [ins.id]: undefined }));
      return;
    }
    try {
      const res = await api.get(`/agents/instructions/${ins.id}/viewings`);
      setExpandedViewings((prev) => ({ ...prev, [ins.id]: res.data.data || [] }));
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load viewings', 'error');
    }
  };

  const handleEditClick = () => {
    setEditForm({
      company_name: data.company_name || '',
      contact_name: data.contact_name || '',
      email: data.email || '',
      phone: data.phone || '',
      redress_scheme: data.redress_scheme || '',
      cmp_provider: data.cmp_provider || '',
      status: data.status || 'active',
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.company_name.trim()) errs.company_name = 'Company name is required';
    if (Object.keys(errs).length > 0) {
      setEditFormErrors(errs);
      return;
    }

    setEditFormErrors({});
    setEditSaving(true);
    try {
      await api.patch(`/agents/${id}`, editForm);
      addToast('Letting agent details updated successfully!', 'success');
      setIsEditModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update letting agent details', 'error');
    } finally {
      setEditSaving(false);
    }
  };

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
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border tracking-wide uppercase ${
            data.status === 'active' ? 'bg-status-success-bg text-status-success border-status-success/15' : 'bg-status-danger-bg text-status-danger border-status-danger/15'
          }`}>
            {data.status}
          </span>
        }
        subtitle={`AGENCY • Added ${new Date(data.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
        editLabel="Edit Profile"
        onEdit={handleEditClick}
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

        {activeTab === 'instructions' && (
          <div className="grid grid-cols-1 gap-6">
            <Card title={`Instructions (${data.instructions?.length || 0})`}>
              <div className="flex justify-end mb-4">
                <Button variant="primary" icon={Plus} size="sm" onClick={() => setIsInstructionModalOpen(true)}>
                  New Instruction
                </Button>
              </div>
              {data.instructions?.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-card-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider">
                        {['Property', 'Landlord', 'Marketing Rent', 'Fee', 'Viewings', 'Status', 'Instructed', 'Actions'].map(h => (
                          <th key={h} className="text-left py-3 px-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-xs-portal">
                      {data.instructions.map(ins => (
                        <Fragment key={ins.id}>
                          <tr className="hover:bg-surface-light/50 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-brand-primary">{ins.property_address}</p>
                            </td>
                            <td className="py-3 px-4 text-status-muted">{ins.landlord_name}</td>
                            <td className="py-3 px-4 font-bold text-brand-primary">{ins.marketing_rent ? `£${parseFloat(ins.marketing_rent).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="py-3 px-4 text-status-muted">{ins.agent_fee_amount ? `£${ins.agent_fee_amount}` : '—'}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleViewings(ins)}
                                className="font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full cursor-pointer hover:bg-brand-accent/20 transition-colors"
                                title={expandedViewings[ins.id] ? 'Hide viewings' : 'Show viewings'}
                              >
                                {ins.viewings_count}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-2xs font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider ${statusColors[ins.status] || statusColors.active}`}>
                                {ins.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-xs">{ins.instructed_at ? new Date(ins.instructed_at).toLocaleDateString('en-GB') : '—'}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" icon={CalendarPlus} onClick={() => { setViewingForm(emptyViewing); setViewingTarget(ins); }}>
                                  Log Viewing
                                </Button>
                                {ins.status === 'active' && (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => handleInstructionStatus(ins, 'completed')}>
                                      Complete
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-status-danger" onClick={() => handleInstructionStatus(ins, 'cancelled')}>
                                      Cancel
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedViewings[ins.id] && (
                            <tr className="bg-surface-light/40">
                              <td colSpan={8} className="py-3 px-6">
                                {expandedViewings[ins.id].length === 0 ? (
                                  <p className="text-xs text-gray-400 font-semibold">No viewings logged for this instruction yet.</p>
                                ) : (
                                  <table className="w-full text-xs-portal">
                                    <thead>
                                      <tr className="text-2xs text-gray-400 font-bold uppercase tracking-wider">
                                        <th className="text-left py-1.5 pr-4">Viewed At</th>
                                        <th className="text-left py-1.5 pr-4">Applicant</th>
                                        <th className="text-left py-1.5 pr-4">Reference</th>
                                        <th className="text-left py-1.5 pr-4">Outcome</th>
                                        <th className="text-left py-1.5">Feedback</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {expandedViewings[ins.id].map((v) => (
                                        <tr key={v.id}>
                                          <td className="py-1.5 pr-4 font-semibold text-brand-primary">{v.viewed_at ? new Date(v.viewed_at).toLocaleString('en-GB') : '—'}</td>
                                          <td className="py-1.5 pr-4">{v.applicant_name || '—'}</td>
                                          <td className="py-1.5 pr-4 text-status-muted">{v.applicant_ref || '—'}</td>
                                          <td className="py-1.5 pr-4">
                                            <span className="text-2xs font-bold uppercase tracking-wider">{v.outcome ? v.outcome.replace(/_/g, ' ') : '—'}</span>
                                          </td>
                                          <td className="py-1.5 text-status-muted">{v.feedback || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-surface-light rounded-xl border border-dashed border-card-border">
                  <Home size={32} className="text-gray-300 mb-3" />
                  <p className="text-sm font-semibold text-status-muted">No instructions recorded</p>
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

      {/* Edit Agent Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">Edit Agent Details</h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <Input
                label="Company Name"
                id="edit-a-company"
                required
                value={editForm.company_name}
                onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                error={editFormErrors.company_name}
              />
              <Input
                label="Contact Name"
                id="edit-a-contact"
                value={editForm.contact_name}
                onChange={(e) => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
              />
              <Input
                label="Email Address"
                id="edit-a-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Phone Number"
                id="edit-a-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="Redress Scheme"
                id="edit-a-redress"
                placeholder="e.g. The Property Ombudsman"
                value={editForm.redress_scheme}
                onChange={(e) => setEditForm(f => ({ ...f, redress_scheme: e.target.value }))}
              />
              <Input
                label="CMP Provider"
                id="edit-a-cmp"
                placeholder="e.g. Client Money Protect"
                value={editForm.cmp_provider}
                onChange={(e) => setEditForm(f => ({ ...f, cmp_provider: e.target.value }))}
              />
              <Dropdown
                label="Agent Status"
                id="edit-a-status"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' }
                ]}
                value={editForm.status}
                onChange={(val) => setEditForm(f => ({ ...f, status: val }))}
              />

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

      {/* New Instruction Modal */}
      {isInstructionModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-card-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">New Instruction</h3>
              <button onClick={() => setIsInstructionModalOpen(false)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInstructionSubmit} className="flex flex-col gap-4">
              <Dropdown
                label="Property"
                id="ins-property"
                placeholder="Select property..."
                options={propertiesList}
                value={instructionForm.property_id}
                onChange={(val) => setInstructionForm(f => ({ ...f, property_id: val }))}
                searchable
              />
              <div className="grid grid-cols-2 gap-4">
                <Dropdown
                  label="Agency Basis"
                  id="ins-basis"
                  options={[
                    { value: 'sole agency', label: 'Sole Agency' },
                    { value: 'multi agency', label: 'Multi Agency' },
                  ]}
                  value={instructionForm.agency_basis}
                  onChange={(val) => setInstructionForm(f => ({ ...f, agency_basis: val }))}
                  placeholder="Select basis..."
                />
                <Dropdown
                  label="Fee Basis"
                  id="ins-fee-basis"
                  options={[
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'fixed', label: 'Fixed Fee' },
                  ]}
                  value={instructionForm.agent_fee_basis}
                  onChange={(val) => setInstructionForm(f => ({ ...f, agent_fee_basis: val }))}
                />
                <Input
                  label={instructionForm.agent_fee_basis === 'fixed' ? 'Agent Fee (£)' : 'Agent Fee (%)'}
                  id="ins-fee-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={instructionForm.agent_fee_amount}
                  onChange={(e) => setInstructionForm(f => ({ ...f, agent_fee_amount: e.target.value }))}
                />
                <Input
                  label="ROCA Letting Fee (£)"
                  id="ins-roca-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={instructionForm.roca_letting_fee}
                  onChange={(e) => setInstructionForm(f => ({ ...f, roca_letting_fee: e.target.value }))}
                />
                <Input
                  label="Marketing Rent (£/month)"
                  id="ins-marketing-rent"
                  type="number"
                  step="0.01"
                  min="0"
                  value={instructionForm.marketing_rent}
                  onChange={(e) => setInstructionForm(f => ({ ...f, marketing_rent: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => setIsInstructionModalOpen(false)} disabled={instructionSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={instructionSaving}>
                  {instructionSaving ? 'Creating…' : 'Create Instruction'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Viewing Modal */}
      {viewingTarget && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-card-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-bold text-brand-primary">Log Viewing</h3>
              <button onClick={() => setViewingTarget(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-status-muted mb-4">{viewingTarget.property_address}</p>

            <form onSubmit={handleViewingSubmit} className="flex flex-col gap-4">
              <Input
                label="Viewed At"
                id="view-at"
                type="datetime-local"
                required
                value={viewingForm.viewed_at}
                onChange={(e) => setViewingForm(f => ({ ...f, viewed_at: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Applicant Name"
                  id="view-applicant"
                  placeholder="e.g. Sam Taylor"
                  value={viewingForm.applicant_name}
                  onChange={(e) => setViewingForm(f => ({ ...f, applicant_name: e.target.value }))}
                />
                <Input
                  label="Applicant Reference"
                  id="view-ref"
                  placeholder="e.g. APP-2211"
                  value={viewingForm.applicant_ref}
                  onChange={(e) => setViewingForm(f => ({ ...f, applicant_ref: e.target.value }))}
                />
              </div>
              <Dropdown
                label="Outcome"
                id="view-outcome"
                placeholder="Select outcome..."
                options={[
                  { value: 'interested', label: 'Interested' },
                  { value: 'not_interested', label: 'Not Interested' },
                  { value: 'offered', label: 'Offer Made' },
                  { value: 'no_show', label: 'No Show' },
                ]}
                value={viewingForm.outcome}
                onChange={(val) => setViewingForm(f => ({ ...f, outcome: val }))}
                clearable
              />
              <Input
                label="Feedback"
                id="view-feedback"
                placeholder="Applicant feedback / notes"
                value={viewingForm.feedback}
                onChange={(e) => setViewingForm(f => ({ ...f, feedback: e.target.value }))}
              />

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => setViewingTarget(null)} disabled={viewingSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={viewingSaving}>
                  {viewingSaving ? 'Saving…' : 'Log Viewing'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DetailContainer>
  );
};
