import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { Plus, X } from 'lucide-react';
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

const COLUMNS = ['New', 'Triaged', 'Awaiting Approval', 'In Progress', 'Complete'];

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
});

// ─── Draggable card ──────────────────────────────────────────────────────────
const DraggableCard = ({ ticket }) => {
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
        <span className="text-2xs text-gray-400 font-semibold">#{ticket.id}</span>
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
const DroppableColumn = ({ id, title, tickets, loading }) => {
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
              <DraggableCard key={ticket.id} ticket={ticket} />
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ property_id: '', urgency: '', title: '', description: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

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
  }, []);

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
      });
      addToast('Maintenance ticket created!', 'success');
      setIsModalOpen(false);
      setForm({ property_id: '', urgency: '', title: '', description: '' });
      fetchTickets();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {/* Title */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary tracking-tight">Maintenance Board</h2>
          <p className="text-sm text-status-muted mt-1">Drag and drop tickets to manage their progress lifecycle.</p>
        </div>
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
    </div>
  );
};
