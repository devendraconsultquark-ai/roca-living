import React from 'react';
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const tenanciesData = [
  { id: 'TNC-9081', tenant: 'Michael Scott', property: 'Flat 12, Living Towers, Manchester M1', start: '2025-06-01', end: '2026-05-31', rent: 1850.00, status: 'Active' },
  { id: 'TNC-9042', tenant: 'Pam Beesly', property: '78 Oak Avenue, Bristol BS2', start: '2024-09-15', end: '2025-09-14', rent: 1400.00, status: 'Active' },
  { id: 'TNC-8971', tenant: 'Jim Halpert', property: '14 High Street, London E14', start: '2025-01-01', end: '2025-12-31', rent: 3100.00, status: 'Expiring Soon' },
  { id: 'TNC-9104', tenant: 'Dwight Schrute', property: '22 Queen Street, Liverpool L3', start: '2026-07-01', end: '2027-06-30', rent: 950.00, status: 'Awaiting Signatures' },
];

export const Tenancies = () => {
  const columns = [
    { header: 'Tenancy ID', accessor: 'id', sortable: true },
    { header: 'Tenant Name', accessor: 'tenant', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { header: 'Start Date', accessor: 'start', sortable: true },
    { header: 'End Date', accessor: 'end', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.rent.toFixed(2)}`
    },
    { 
      header: 'Agreement Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Active' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
            : row.status === 'Expiring Soon'
              ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
              : 'bg-status-warning/10 text-status-warning border-status-warning/20'
        }`}>
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Tenancy Agreements</h2>
          <p className="text-sm text-gray-500 mt-1">Review active leases, rental payouts, and pending contract agreements.</p>
        </div>
        <Button variant="primary" icon={Calendar} className="shadow-sm">
          Draft Agreement
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Active Leases"
          value="82 Contracts"
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
        />
        <StatCard
          label="Expiring In 60 Days"
          value="4 Agreements"
          icon={AlertCircle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor="text-status-danger"
        />
        <StatCard
          label="Awaiting Signature"
          value="2 Contracts"
          icon={Clock}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={tenanciesData} />
      </div>
    </div>
  );
};
