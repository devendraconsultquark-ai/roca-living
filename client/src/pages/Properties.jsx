import React from 'react';
import { Home, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';

const landlordProperties = [
  { id: 'PR-101', address: 'Flat 12, Living Towers, Manchester M1', tenant: 'Michael Scott', rent: 1850.00, occupancy: 'Occupied', gasCompliance: 'Compliant', epcCompliance: 'Compliant', eicrCompliance: 'Compliant' },
  { id: 'PR-102', address: '78 Oak Avenue, Bristol BS2', tenant: 'Pam Beesly', rent: 1400.00, occupancy: 'Occupied', gasCompliance: 'Compliant', epcCompliance: 'Compliant', eicrCompliance: 'Compliant' },
  { id: 'PR-103', address: '14 High Street, London E14', tenant: 'Jim Halpert', rent: 3100.00, occupancy: 'Occupied', gasCompliance: 'Action Required', epcCompliance: 'Compliant', eicrCompliance: 'Compliant' },
];

export const Properties = () => {
  const columns = [
    { header: 'Property Ref', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'address', sortable: true },
    { header: 'Current Tenant', accessor: 'tenant', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.rent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    { 
      header: 'Occupancy', 
      accessor: 'occupancy',
      renderCell: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-brand-accent/10 text-brand-accent border-brand-accent/20">
          {row.occupancy}
        </span>
      )
    },
    { 
      header: 'Gas Certificate', 
      accessor: 'gasCompliance',
      renderCell: (row) => (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          row.gasCompliance === 'Compliant' ? 'text-status-success' : 'text-status-danger animate-pulse'
        }`}>
          {row.gasCompliance === 'Compliant' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {row.gasCompliance}
        </span>
      )
    },
    { 
      header: 'EPC Safety', 
      accessor: 'epcCompliance',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-status-success font-semibold">
          <CheckCircle2 size={13} />
          {row.epcCompliance}
        </span>
      )
    },
    { 
      header: 'EICR Electrical', 
      accessor: 'eicrCompliance',
      renderCell: (row) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-status-success font-semibold">
          <CheckCircle2 size={13} />
          {row.eicrCompliance}
        </span>
      )
    },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">My Properties</h2>
        <p className="text-sm text-gray-500 mt-1">Review active property listings, rent payouts, and regulatory safety check checklists.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Managed Units</span>
            <span className="text-xl font-bold text-[#1A1A1A] mt-0.5">3 Properties</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Home size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Gross Yield</span>
            <span className="text-xl font-bold text-status-success mt-0.5">£6,350.00</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
            <Key size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance Status</span>
            <span className="text-xl font-bold text-status-warning mt-0.5">1 Attention Required</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={landlordProperties} />
      </div>
    </div>
  );
};
