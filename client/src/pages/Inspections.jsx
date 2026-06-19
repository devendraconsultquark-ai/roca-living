import React from 'react';
import { Eye, CheckCircle2, Clock } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';

const inspectionsData = [
  { id: 'INS-012', property: 'Flat 12, Living Towers, Manchester M1', date: '2025-12-14', inspector: 'Harvey Specter', rating: 'Excellent (Pass)', comments: 'Property is in excellent condition. No dampness or leaks found. Radiators bleed correctly.' },
  { id: 'INS-009', property: '78 Oak Avenue, Bristol BS2', date: '2025-05-18', inspector: 'Mike Ross', rating: 'Good (Pass)', comments: 'Minor paint peeling detected in bathroom door frames. Otherwise standard wear and tear.' },
];

export const Inspections = () => {
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
            <span className="text-xl font-bold text-status-success mt-0.5">2 Audited</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Next Scheduled Audit</span>
            <span className="text-xl font-bold text-[#1A1A1A] mt-0.5">Sept 2026</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={inspectionsData} />
      </div>
    </div>
  );
};
