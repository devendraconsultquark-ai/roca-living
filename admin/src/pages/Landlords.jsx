import React from 'react';
import { Users, UserPlus } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const landlordsData = [
  { id: 'LL-001', name: 'John Doe', email: 'john.doe@gmail.com', phone: '+44 7123 456789', propertiesCount: 3, payouts: 14500.00, status: 'Active' },
  { id: 'LL-002', name: 'Sarah Jenkins', email: 'sarah.jenkins@yahoo.com', phone: '+44 7987 654321', propertiesCount: 5, payouts: 26800.00, status: 'Active' },
  { id: 'LL-003', name: 'Robert Vance', email: 'robert@vance-realty.co.uk', phone: '+44 7555 123456', propertiesCount: 12, payouts: 64900.00, status: 'Active' },
  { id: 'LL-004', name: 'Emily Carter', email: 'emily.carter@outlook.com', phone: '+44 7333 987654', propertiesCount: 2, payouts: 8400.00, status: 'Pending Verification' },
  { id: 'LL-005', name: 'William Hughes', email: 'william@hughes-group.co.uk', phone: '+44 7444 654987', propertiesCount: 8, payouts: 38200.00, status: 'Active' },
];

export const Landlords = () => {
  const columns = [
    { header: 'Landlord ID', accessor: 'id', sortable: true },
    { header: 'Full Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Contact Phone', accessor: 'phone' },
    { 
      header: 'Properties', 
      accessor: 'propertiesCount', 
      align: 'center', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
          {row.propertiesCount}
        </span>
      )
    },
    { 
      header: 'YTD Paid Out', 
      accessor: 'payouts', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.payouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    { 
      header: 'Disbursement Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Active' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
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
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Landlords Directory</h2>
          <p className="text-sm text-gray-500 mt-1">Review contact records, active portfolios, and compliance details for registered landlords.</p>
        </div>
        <Button variant="primary" icon={UserPlus} className="shadow-sm">
          Register Landlord
        </Button>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          label="Total Landlords"
          value="48 Registered"
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
        />
        <StatCard
          label="Active Payouts"
          value="47 Cleared"
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Awaiting Verification"
          value="1 Landlord"
          icon={Users}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-status-warning"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={landlordsData} />
      </div>
    </div>
  );
};
