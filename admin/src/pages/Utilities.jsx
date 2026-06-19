import React from 'react';
import { Droplet, CheckCircle2, Clock } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const utilitiesData = [
  { id: 'UT-001', property: 'Flat 12, Living Towers, Manchester M1', provider: 'British Gas', type: 'Gas & Electricity', date: '2025-06-01', status: 'Completed' },
  { id: 'UT-002', property: '78 Oak Avenue, Bristol BS2', provider: 'Bristol Water', type: 'Water Supply', date: '2024-09-15', status: 'Completed' },
  { id: 'UT-003', property: '14 High Street, London E14', provider: 'Tower Hamlets Council', type: 'Council Tax', date: '2025-01-01', status: 'Completed' },
  { id: 'UT-004', property: '22 Queen Street, Liverpool L3', provider: 'Scottish Power', type: 'Gas & Electricity', date: '2026-07-01', status: 'Pending Transfer' },
];

export const Utilities = () => {
  const columns = [
    { header: 'Handover ID', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { header: 'Provider Name', accessor: 'provider', sortable: true },
    { header: 'Utility Type', accessor: 'type', sortable: true },
    { header: 'Handover Date', accessor: 'date', sortable: true },
    { 
      header: 'Transfer Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Completed' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
            : 'bg-status-warning/10 text-status-warning border-status-warning/20 animate-pulse'
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Utility Handover Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Track energy, council tax, and water service transfers during tenant check-in and check-out periods.</p>
        </div>
        <Button variant="primary" icon={Droplet} className="shadow-sm">
          Trigger Handover Transfer
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Completed Transfers"
          value="82 Accounts"
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Pending Transfer Checks"
          value="1 Account"
          icon={Clock}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={utilitiesData} />
      </div>
    </div>
  );
};
