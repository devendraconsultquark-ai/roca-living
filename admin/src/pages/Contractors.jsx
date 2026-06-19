import React from 'react';
import { UserCog, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';

const contractorsData = [
  { id: 'CON-001', name: 'Warmth Heating Ltd', trade: 'Heating & Gas Safety', phone: '+44 7711 223344', email: 'service@warmthheating.co.uk', rating: '5.0 ★', status: 'Active (Insured)' },
  { id: 'CON-002', name: 'Bristol Glazing & Joinery', trade: 'Joinery & Windows', phone: '+44 7722 334455', email: 'office@bristolglazing.com', rating: '4.8 ★', status: 'Active (Insured)' },
  { id: 'CON-003', name: 'Volt Electrical Partners', trade: 'Electrical & EICR Specialist', phone: '+44 7733 445566', email: 'volt@electricalpartners.co.uk', rating: '4.9 ★', status: 'Active (Insured)' },
  { id: 'CON-004', name: 'Rapid Plumbers Ltd', trade: 'Plumbing & Leaks', phone: '+44 7744 556677', email: 'help@rapidplumbing.co.uk', rating: '4.2 ★', status: 'Suspended (Insurance Expired)' },
];

export const Contractors = () => {
  const columns = [
    { header: 'Contractor ID', accessor: 'id', sortable: true },
    { header: 'Company / Name', accessor: 'name', sortable: true },
    { header: 'Trade Specialty', accessor: 'trade', sortable: true },
    { header: 'Phone Number', accessor: 'phone' },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Rating', accessor: 'rating', sortable: true },
    { 
      header: 'Insurance Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          row.status.includes('Active') ? 'text-status-success' : 'text-status-danger'
        }`}>
          {row.status.includes('Active') ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {row.status}
        </span>
      )
    },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Contractors Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Review contact records, active insurance statuses, and ratings of maintenance contractors.</p>
        </div>
        <Button variant="primary" icon={UserCog} className="shadow-sm">
          Add Contractor
        </Button>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={contractorsData} />
      </div>
    </div>
  );
};
