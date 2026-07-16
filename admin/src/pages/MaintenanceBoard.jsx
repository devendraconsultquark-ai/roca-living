import { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, X, Ban } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

// ─── Status mapping: API values ↔ board column IDs ──────────────────────────
const API_TO_BOARD = {
  new: 'New',
  triaged: 'Triaged',
  awaiting_approval: 'Awaiting Approval',
  in_progress: 'In Progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

const BOARD_TO_API = Object.fromEntries(Object.entries(API_TO_BOARD).map(([k, v]) => [v, k]));

const COLUMNS = ['New', 'Triaged', 'Awaiting Approval', 'In Progress', 'Complete', 'Cancelled'];

// Mirrors the server-side state machine (maintenanceController VALID_TRANSITIONS) so the
// board doesn't offer moves the API will reject with a 400.
const VALID_TRANSITIONS = {
  new: ['triaged', 'cancelled'],
  triaged: ['awaiting_approval', 'in_progress', 'cancelled'],
  awaiting_approval: ['in_progress', 'cancelled'],
  in_progress: ['complete', 'cancelled'],
  complete: [],
  cancelled: [],
};

const URGENCY_LABELS = {
  emergency: 'Emergency',
  urgent: 'Urgent',
  routine: 'Routine',
};

const mapTicket = (t) => ({
  id: t.id,
  address: t.address_line1
    ? `${t.address_line1}, ${t.city || ''}`.trim().replace(/,$/, '')
    : `Property #${t.property_id}`,
  urgency: URGENCY_LABELS[t.urgency] || t.urgency,
  description: t.description,
  contractor: t.contractor_company || t.contractor_name || '—',
  title: t.title,
  status: API_TO_BOARD[t.status] || 'New',
  raw: t,
});

// ─── Draggable card ──────────────────────────────────────────────────────────
const DraggableCard = ({ ticket, onOpenDetail }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  const urgencyStyles = {
    Routine: 'bg-status-success-bg text-status-success border-status-success/15',
    Urgent: 'bg-status-warning/10 text-status-warning border-status-warning/15',
    Emergency: 'bg-status-danger-bg text-status-danger border-status-danger/15',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="card-bg p-4 rounded-card border border-card-border shadow-premium select-none transition-shadow flex flex-col gap-2 relative z-10"
    >
      <div className="flex justify-between items-center">
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${urgencyStyles[ticket.urgency] || urgencyStyles.Routine}`}>
          {ticket.urgency}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-gray-400 font-semibold">#{ticket.id}</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenDetail(ticket)}
            className="text-2xs font-bold text-brand-accent hover:underline cursor-pointer"
            title="Open ticket details"
          >
            Details
          </button>
        </div>
      </div>
      <h4 className="text-sm font-bold text-brand-primary leading-tight mt-1">
        {ticket.address}
      </h4>
      <p className="text-xs text-status-muted leading-snug line-clamp-2">
        {ticket.description}
      </p>
      <div className="border-t border-card-border pt-2.5 mt-1.5 flex justify-between items-center text-2xs text-gray-400 font-semibold">
        <span>Contractor:</span>
        <span className="text-brand-primary font-bold">{ticket.contractor}</span>
      </div>
    </div>
  );
};

// ─── Droppable column ────────────────────────────────────────────────────────
const DroppableColumn = ({ id, title, tickets, loading, onOpenDetail }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const count = tickets.length;

  return (
    <div className="flex flex-col flex-1 min-w-[240px] bg-surface-light rounded-card border border-card-border overflow-hidden">
      <div className="card-bg px-4 py-3.5 border-b border-card-border flex justify-between items-center select-none">
        <h3 className="text-sm-portal font-bold text-brand-primary tracking-wide">{title}</h3>
        <span className="bg-surface-hover text-brand-primary text-2xs font-bold px-2 py-0.5 rounded-sm border border-card-border">
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-grow p-3 flex flex-col gap-3 min-h-[480px] transition-colors duration-200 ${
          isOver ? 'bg-brand-accent/5 border-2 border-dashed border-brand-accent/30 rounded-b-card' : ''
        }`}
      >
        {loading ? (
          <div className="flex flex-col gap-3 py-1">
            <Skeleton radius="card" className="h-28 w-full" />
            <Skeleton radius="card" className="h-28 w-full" />
          </div>
        ) : (
          <>
            {tickets.map(ticket => (
              <DraggableCard key={ticket.id} ticket={ticket} onOpenDetail={onOpenDetail} />
            ))}
            {count === 0 && (
              <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 font-medium py-12 select-none">
                No tickets in this stage
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────
export const MaintenanceBoard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ property_id: '', urgency: '', title: '', description: '', quote_amount: '', spend_threshold_auto_approve: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  // Ticket detail modal
  const [detailTicket, setDetailTicket] = useState(null); // mapped ticket or null
  const [detailForm, setDetailForm] = useState({ contractor_id: '', quote_amount: '' });
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailImages, setDetailImages] = useState([]); // [{id, original_name, url}]

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance');
      setTickets((res.data.data || []).map(mapTicket));
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load maintenance tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await api.get('/properties');
      setProperties((res.data.data || []).map(p => ({
        value: p.id,
        label: `${p.address_line1}, ${p.city}`,
      })));
    } catch {
      // non-blocking — property dropdown degrades gracefully
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchProperties();
    api.get('/maintenance/contractors').then((res) => {
      setContractors((res.data.data || [])
        .filter((c) => c.status === 'active')
        .map((c) => ({ value: c.id, label: `${c.company_name} (${c.trade})` })));
    }).catch(() => { /* assignment dropdown degrades gracefully */ });
  }, []);

  const openDetail = async (ticket) => {
    setDetailTicket(ticket);
    setDetailForm({
      contractor_id: ticket.raw.contractor_id || '',
      quote_amount: ticket.raw.quote_amount != null ? String(ticket.raw.quote_amount) : '',
    });
    setDetailImages([]);
    try {
      const res = await api.get(`/maintenance/${ticket.id}/images`);
      const rows = res.data.data || [];
      const withUrls = await Promise.all(rows.map(async (img) => {
        try {
          const blobRes = await api.get(`/maintenance/images/${img.id}`, { responseType: 'blob' });
          return { ...img, url: window.URL.createObjectURL(blobRes.data) };
        } catch {
          return { ...img, url: null };
        }
      }));
      setDetailImages(withUrls);
    } catch {
      // Ticket may have no images — the section just stays empty.
    }
  };

  const closeDetail = () => {
    detailImages.forEach((img) => { if (img.url) window.URL.revokeObjectURL(img.url); });
    setDetailTicket(null);
    setDetailImages([]);
  };

  const handleDetailSave = async (e) => {
    e.preventDefault();
    setDetailSaving(true);
    try {
      const payload = {};
      if (detailForm.contractor_id !== (detailTicket.raw.contractor_id || '')) {
        payload.contractor_id = detailForm.contractor_id || null;
      }
      if (detailForm.quote_amount !== '' && parseFloat(detailForm.quote_amount) !== parseFloat(detailTicket.raw.quote_amount || 0)) {
        payload.quote_amount = parseFloat(detailForm.quote_amount);
      }
      if (Object.keys(payload).length === 0) {
        addToast('Nothing to save', 'info');
        setDetailSaving(false);
        return;
      }
      await api.patch(`/maintenance/${detailTicket.id}/status`, payload);
      addToast(`Ticket #${detailTicket.id} updated`, 'success');
      closeDetail();
      fetchTickets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update ticket', 'error');
    } finally {
      setDetailSaving(false);
    }
  };

  const handleCancelTicket = async () => {
    const apiStatus = BOARD_TO_API[detailTicket.status];
    if (!(VALID_TRANSITIONS[apiStatus] || []).includes('cancelled')) {
      addToast(`A "${detailTicket.status}" ticket cannot be cancelled.`, 'error');
      return;
    }
    try {
      await api.patch(`/maintenance/${detailTicket.id}/status`, { status: 'cancelled' });
      addToast(`Ticket #${detailTicket.id} cancelled`, 'success');
      closeDetail();
      fetchTickets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to cancel ticket', 'error');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id;
    const newBoardStatus = over.id;
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status === newBoardStatus) return;

    const currentApiStatus = BOARD_TO_API[ticket.status];
    const apiStatus = BOARD_TO_API[newBoardStatus];

    // Block moves the server would reject, with a clear message instead of a generic failure.
    if (!(VALID_TRANSITIONS[currentApiStatus] || []).includes(apiStatus)) {
      addToast(`Can't move a "${ticket.status}" ticket to "${newBoardStatus}".`, 'error');
      return;
    }

    // Optimistic update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newBoardStatus } : t));

    try {
      await api.patch(`/maintenance/${ticketId}/status`, { status: apiStatus });
      addToast(`Ticket #${ticketId} moved to ${newBoardStatus}`, 'success');
    } catch (err) {
      // Revert on failure
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: ticket.status } : t));
      addToast(err.response?.data?.message || `Failed to update ticket status`, 'error');
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.property_id) errs.property_id = 'Select a property';
    if (!form.urgency) errs.urgency = 'Select urgency level';
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setFormErrors({});
    setSubmitting(true);
    try {
      await api.post('/maintenance', {
        property_id: form.property_id,
        urgency: form.urgency,
        title: form.title,
        description: form.description,
        quote_amount: form.quote_amount !== '' ? parseFloat(form.quote_amount) : undefined,
        spend_threshold_auto_approve: form.spend_threshold_auto_approve !== '' ? parseFloat(form.spend_threshold_auto_approve) : undefined,
      });
      addToast('Maintenance ticket created!', 'success');
      setIsModalOpen(false);
      setForm({ property_id: '', urgency: '', title: '', description: '', quote_amount: '', spend_threshold_auto_approve: '' });
      fetchTickets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="mb-6 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          New Ticket
        </Button>
      </div>

      {/* Board */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
          {COLUMNS.map(col => (
            <DroppableColumn
              key={col}
              id={col}
              title={col}
              tickets={tickets.filter(t => t.status === col)}
              loading={loading}
              onOpenDetail={openDetail}
            />
          ))}
        </div>
      </DndContext>

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-primary">New Maintenance Ticket</h3>
              <button onClick={() => { setIsModalOpen(false); setFormErrors({}); }} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Property <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="modal-property"
                  placeholder="Select property..."
                  options={properties}
                  value={form.property_id}
                  onChange={(val) => setForm(f => ({ ...f, property_id: val }))}
                  searchable
                />
                {formErrors.property_id && <span className="text-xs text-status-danger font-semibold">{formErrors.property_id}</span>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-status-muted uppercase tracking-wide">Urgency <span className="text-status-danger">*</span></label>
                <Dropdown
                  id="modal-urgency"
                  placeholder="Select urgency..."
                  options={[
                    { value: 'emergency', label: 'Emergency' },
                    { value: 'urgent', label: 'Urgent' },
                    { value: 'routine', label: 'Routine' },
                  ]}
                  value={form.urgency}
                  onChange={(val) => setForm(f => ({ ...f, urgency: val }))}
                />
                {formErrors.urgency && <span className="text-xs text-status-danger font-semibold">{formErrors.urgency}</span>}
              </div>

              <Input
                label="Title"
                id="modal-title"
                required
                placeholder="e.g. Boiler not heating"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                error={formErrors.title}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="modal-description" className="text-xs font-semibold text-status-muted uppercase tracking-wide">
                  Description <span className="text-status-danger">*</span>
                </label>
                <textarea
                  id="modal-description"
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  className={`w-full text-sm bg-white border border-card-border rounded-lg py-2.5 px-3 transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent ${formErrors.description ? 'border-status-danger' : ''}`}
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                />
                {formErrors.description && <span className="text-xs text-status-danger font-semibold">{formErrors.description}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quote Amount (£, optional)"
                  id="modal-quote"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 180.00"
                  value={form.quote_amount}
                  onChange={(e) => setForm(f => ({ ...f, quote_amount: e.target.value }))}
                />
                <Input
                  label="Auto-approve Threshold (£)"
                  id="modal-threshold"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Default 250.00"
                  value={form.spend_threshold_auto_approve}
                  onChange={(e) => setForm(f => ({ ...f, spend_threshold_auto_approve: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 justify-end mt-1">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setFormErrors({}); }}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {detailTicket && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl border border-card-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-bold text-brand-primary">Ticket #{detailTicket.id} — {detailTicket.title || detailTicket.address}</h3>
              <button onClick={closeDetail} className="text-gray-400 hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-status-muted mb-4">{detailTicket.address}</p>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xs font-bold bg-surface-hover text-brand-primary border border-card-border px-2 py-0.5 rounded-sm uppercase tracking-wider">
                {detailTicket.status}
              </span>
              <span className="text-2xs font-bold bg-surface-hover text-brand-primary border border-card-border px-2 py-0.5 rounded-sm uppercase tracking-wider">
                {detailTicket.urgency}
              </span>
              {detailTicket.raw.landlord_approved === 1 && (
                <span className="text-2xs font-bold bg-status-success-bg text-status-success border border-status-success/15 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                  Landlord Approved
                </span>
              )}
              {detailTicket.raw.landlord_approved === 0 && detailTicket.raw.landlord_approved_at === null && detailTicket.raw.status === 'cancelled' && (
                <span className="text-2xs font-bold bg-status-danger-bg text-status-danger border border-status-danger/15 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                  Quote Declined
                </span>
              )}
            </div>

            <p className="text-sm text-status-muted leading-relaxed mb-4 bg-surface-light border border-card-border rounded-card p-3">
              {detailTicket.description}
            </p>

            <form onSubmit={handleDetailSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Dropdown
                  label="Assigned Contractor"
                  id="detail-contractor"
                  placeholder="Assign contractor..."
                  options={contractors}
                  value={detailForm.contractor_id}
                  onChange={(val) => setDetailForm(f => ({ ...f, contractor_id: val }))}
                  searchable
                  clearable
                />
                <Input
                  label="Quote Amount (£)"
                  id="detail-quote"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 180.00"
                  value={detailForm.quote_amount}
                  onChange={(e) => setDetailForm(f => ({ ...f, quote_amount: e.target.value }))}
                />
              </div>

              {detailImages.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-status-muted uppercase tracking-wide">Photos ({detailImages.length})</span>
                  <div className="grid grid-cols-3 gap-2">
                    {detailImages.map((img) => (
                      img.url ? (
                        <a key={img.id} href={img.url} target="_blank" rel="noreferrer" title={img.original_name || `Image ${img.id}`}>
                          <img src={img.url} alt={img.original_name || `Ticket image ${img.id}`} className="w-full h-24 object-cover rounded-card border border-card-border hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <div key={img.id} className="w-full h-24 rounded-card border border-dashed border-card-border flex items-center justify-center text-2xs text-gray-400">
                          Unavailable
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mt-1">
                {(VALID_TRANSITIONS[BOARD_TO_API[detailTicket.status]] || []).includes('cancelled') ? (
                  <Button type="button" variant="ghost" icon={Ban} className="text-status-danger" onClick={handleCancelTicket}>
                    Cancel Ticket
                  </Button>
                ) : <span />}
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={closeDetail} disabled={detailSaving}>
                    Close
                  </Button>
                  <Button type="submit" variant="primary" disabled={detailSaving}>
                    {detailSaving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
