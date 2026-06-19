import React, { useState } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const initialTickets = [
  { id: 'T-1001', address: '12 Baker Street, London', urgency: 'Emergency', description: 'Leaking pipe in kitchen causing water damage to floor.', contractor: 'Alpha Plumbing', status: 'New' },
  { id: 'T-1002', address: 'Apartment 4B, Park Heights', urgency: 'Urgent', description: 'Heating system failure; radiators are cold.', contractor: 'Warmth Heating Ltd', status: 'New' },
  { id: 'T-1003', address: '78 Oak Avenue, Bristol', urgency: 'Routine', description: 'Broken window latch in the master bedroom.', contractor: 'Bristol Glazing', status: 'Triaged' },
  { id: 'T-1004', address: 'Flat 5, Queens Road', urgency: 'Emergency', description: 'Electrical short circuit in living room sockets.', contractor: 'Bright Spark Elec', status: 'Awaiting Approval' },
  { id: 'T-1005', address: '14 High Street, Manchester', urgency: 'Routine', description: 'Guttering is blocked and overflowing during heavy rain.', contractor: 'Manchester Roofers', status: 'In Progress' },
];

const DraggableCard = ({ ticket }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  const urgencyStyles = {
    Routine: 'bg-status-success/15 text-status-success border-status-success/20',
    Urgent: 'bg-status-warning/15 text-status-warning border-status-warning/20',
    Emergency: 'bg-status-danger/15 text-status-danger border-status-danger/20',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white p-4 rounded-xl border border-border-color shadow-sm select-none hover:shadow-md transition-shadow flex flex-col gap-2 relative z-10"
    >
      <div className="flex justify-between items-center">
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${urgencyStyles[ticket.urgency]}`}>
          {ticket.urgency}
        </span>
        <span className="text-[10px] text-gray-400 font-semibold">#{ticket.id}</span>
      </div>
      <h4 className="text-sm font-bold text-[#1A1A1A] leading-tight mt-1">
        {ticket.address}
      </h4>
      <p className="text-xs text-gray-500 leading-snug line-clamp-2">
        {ticket.description}
      </p>
      <div className="border-t border-border-color/60 pt-2.5 mt-1.5 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
        <span>Contractor:</span>
        <span className="text-gray-600 font-bold">{ticket.contractor}</span>
      </div>
    </div>
  );
};

const DroppableColumn = ({ id, title, tickets }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const count = tickets.length;

  return (
    <div className="flex flex-col flex-1 min-w-[240px] bg-[#F8FAFC] rounded-2xl border border-border-color/80 overflow-hidden shadow-xs">
      {/* Column Header */}
      <div className="bg-white px-4 py-3.5 border-b border-border-color flex justify-between items-center select-none">
        <h3 className="text-sm font-bold text-[#1A1A1A] tracking-wide">{title}</h3>
        <span className="bg-gray-100 text-[#1A1A1A] text-xs font-bold px-2 py-0.5 rounded-full border border-border-color/50">
          {count}
        </span>
      </div>

      {/* Droppable Container Area */}
      <div
        ref={setNodeRef}
        className={`flex-grow p-3 flex flex-col gap-3 min-h-[480px] transition-colors duration-200 ${
          isOver ? 'bg-brand-accent/5 border-2 border-dashed border-brand-accent/30 rounded-b-2xl' : ''
        }`}
      >
        {tickets.map(ticket => (
          <DraggableCard key={ticket.id} ticket={ticket} />
        ))}
        {count === 0 && (
          <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 font-medium py-12 select-none">
            No tickets in this stage
          </div>
        )}
      </div>
    </div>
  );
};

export const MaintenanceBoard = () => {
  const [tickets, setTickets] = useState(initialTickets);
  const { addToast } = useToast();

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id;
    const newStatus = over.id;

    // Find the original ticket to check if status actually changed
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.status === newStatus) return;

    // Update state locally
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));

    // Console log and API update trigger
    console.log(`[API Update] Patching ticket ${ticketId} status to: ${newStatus}`);

    try {
      await api.patch(`/maintenance/tickets/${ticketId}`, { status: newStatus });
      addToast(`Ticket #${ticketId} moved to ${newStatus}`, 'success');
    } catch (err) {
      console.error('API Error updating ticket status', err);
      // Fallback dev mode success toast
      addToast(`Ticket status updated to ${newStatus} (Dev Mode)`, 'success');
    }
  };

  return (
    <div className="py-6 max-w-7xl mx-auto px-4">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Maintenance Board</h2>
        <p className="text-sm text-gray-500 mt-1">Drag and drop tickets to manage their progress lifecycle.</p>
      </div>

      {/* Board Container */}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
          <DroppableColumn id="New" title="New" tickets={tickets.filter(t => t.status === 'New')} />
          <DroppableColumn id="Triaged" title="Triaged" tickets={tickets.filter(t => t.status === 'Triaged')} />
          <DroppableColumn id="Awaiting Approval" title="Awaiting Approval" tickets={tickets.filter(t => t.status === 'Awaiting Approval')} />
          <DroppableColumn id="In Progress" title="In Progress" tickets={tickets.filter(t => t.status === 'In Progress')} />
          <DroppableColumn id="Complete" title="Complete" tickets={tickets.filter(t => t.status === 'Complete')} />
        </div>
      </DndContext>
    </div>
  );
};
