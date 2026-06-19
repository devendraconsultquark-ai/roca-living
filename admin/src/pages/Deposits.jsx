import React from 'react';
import { PiggyBank, ShieldCheck } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const depositsData = [
  { id: 'DEP-8971', tenancyId: 'TNC-9081', tenant: 'Michael Scott', amount: 2134.61, date: '2025-06-02', tdsNum: 'TDS-6781249', status: 'Protected' },
  { id: 'DEP-8972', tenancyId: 'TNC-9042', tenant: 'Pam Beesly', amount: 1615.38, date: '2024-09-16', tdsNum: 'TDS-6541892', status: 'Protected' },
  { id: 'DEP-8973', tenancyId: 'TNC-8971', tenant: 'Jim Halpert', amount: 3576.92, date: '2025-01-02', tdsNum: 'TDS-6632490', status: 'Protected' },
  { id: 'DEP-8974', tenancyId: 'TNC-9104', tenant: 'Dwight Schrute', amount: 1096.15, date: '2026-07-02', tdsNum: 'TDS-Pending', status: 'Awaiting Transfer' },
];

export const Deposits = () => {
  const columns = [
    { header: 'Deposit ID', accessor: 'id', sortable: true },
    { header: 'Tenancy Ref', accessor: 'tenancyId', sortable: true },
    { header: 'Tenant Name', accessor: 'tenant', sortable: true },
    { 
      header: 'Amount Held', 
      accessor: 'amount', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    { header: 'Date Received', accessor: 'date', sortable: true },
    { 
      header: 'TDS Reference', 
      accessor: 'tdsNum', 
      sortable: true,
      renderCell: (row) => (
        <span className={row.tdsNum === 'TDS-Pending' ? 'text-status-warning font-bold' : 'text-gray-700 font-mono font-medium'}>
          {row.tdsNum}
        </span>
      )
    },
    { 
      header: 'TDS Protection Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Protected' 
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Deposit Protection (TDS)</h2>
          <p className="text-sm text-gray-500 mt-1">Audit escrow deposit balances and track registered Tenancy Deposit Scheme registrations.</p>
        </div>
        <Button variant="primary" icon={ShieldCheck} className="shadow-sm">
          Register TDS Deposit
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Protected Deposits Held"
          value="£148,250.00"
          icon={PiggyBank}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Awaiting Scheme Protection"
          value="£1,096.15"
          icon={ShieldCheck}
          iconColor="text-status-warning bg-status-warning/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={depositsData} />
      </div>
    </div>
  );
};
