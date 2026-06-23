import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle2, Clock } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const RATING_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  satisfactory: 'Satisfactory',
  unsatisfactory: 'Unsatisfactory',
};

const mapInspection = (i) => ({
  id: i.id,
  property: i.address_line1
    ? `${i.address_line1}, ${i.city || ''}`.trim().replace(/,$/, '')
    : `Property #${i.property_id}`,
  date: i.inspected_at
    ? new Date(i.inspected_at).toLocaleDateString('en-GB')
    : '—',
  inspector: i.inspected_by || '—',
  rating: RATING_LABELS[i.rating] || i.rating || '—',
  comments: i.notes || '—',
  next_inspection_due: i.next_inspection_due || null,
});

export const Inspections = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchInspections = async () => {
      setLoading(true);
      try {
        const res = await api.get('/inspections/my');
        setInspections((res.data.data || []).map(mapInspection));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load inspections', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchInspections();
  }, []);

  // Derive stat card values from live data
  const completedCount = inspections.length;

  const nextDue = inspections
    .map(i => i.next_inspection_due)
    .filter(Boolean)
    .sort()
    .at(0);

  const nextDueDisplay = nextDue
    ? new Date(nextDue).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : 'Not scheduled';

  const columns = [
    { header: 'Inspection ID', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { header: 'Inspection Date', accessor: 'date', sortable: true },
    { header: 'Inspector Name', accessor: 'inspector', sortable: true },
    {
      header: 'Condition Rating',
      accessor: 'rating',
      renderCell: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-status-success/10 text-status-success border-status-success/20">
          {row.rating}
        </span>
      )
    },
    { header: 'Inspector Comments & Notes', accessor: 'comments' },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Property Inspections History</h2>
        <p className="text-sm text-gray-500 mt-1">Review historical inspection schedules, conditions records, and agency feedback reports.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 select-none">
        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed Inspections</span>
            <span className="text-xl font-bold text-status-success mt-0.5">
              {loading ? '—' : `${completedCount} Audited`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Next Scheduled Audit</span>
            <span className="text-xl font-bold text-[#1A1A1A] mt-0.5">
              {loading ? '—' : nextDueDisplay}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : (
          <DataTable columns={columns} data={inspections} />
        )}
      </div>
    </div>
  );
};
