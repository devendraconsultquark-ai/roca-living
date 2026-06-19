import React from 'react';
import { Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const tenantsData = [
  { id: 'TNT-501', name: 'Michael Scott', email: 'michael@dundermifflin.com', phone: '+44 7900 112233', property: 'Flat 12, Living Towers, Manchester M1', balance: 0.00, status: 'Active' },
  { id: 'TNT-502', name: 'Pam Beesly', email: 'pam@dundermifflin.com', phone: '+44 7900 445566', property: '78 Oak Avenue, Bristol BS2', balance: -150.00, status: 'In Arrears' },
  { id: 'TNT-503', name: 'Jim Halpert', email: 'jim@dundermifflin.com', phone: '+44 7900 778899', property: '14 High Street, London E14', balance: 0.00, status: 'Active' },
  { id: 'TNT-504', name: 'Angela Martin', email: 'angela@dundermifflin.com', phone: '+44 7900 990011', property: '22 Queen Street, Liverpool L3', balance: 0.00, status: 'Active' },
];

export const Tenants = () => {
  const columns = [
    { header: 'Tenant ID', accessor: 'id', sortable: true },
    { header: 'Full Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Phone Number', accessor: 'phone' },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { 
      header: 'Account Balance', 
      accessor: 'balance', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className={row.balance < 0 ? 'text-status-danger font-bold' : 'text-status-success font-semibold'}>
          {row.balance < 0 ? `-£${Math.abs(row.balance).toFixed(2)}` : `£${row.balance.toFixed(2)}`}
        </span>
      )
    },
    { 
      header: 'Account Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Active' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
            : 'bg-status-danger/10 text-status-danger border-status-danger/20 animate-pulse'
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Tenants CRM</h2>
          <p className="text-sm text-gray-500 mt-1">Manage tenant communications, contact directory, and ledger account balances.</p>
        </div>
        <Button variant="primary" icon={Users} className="shadow-sm">
          Add New Tenant
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Total Tenants"
          value="114 Residents"
          icon={Users}
          iconColor="text-brand-primary bg-brand-primary/10"
        />
        <StatCard
          label="Payments Up to Date"
          value="112 Accounts"
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Tenants in Arrears"
          value="2 Accounts"
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor="text-status-danger"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={tenantsData} />
      </div>
    </div>
  );
};
