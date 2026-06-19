import React from 'react';
import { Home, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const propertiesData = [
  { id: 'PROP-101', address: 'Flat 12, Living Towers, Manchester M1', landlord: 'John Doe', rent: 1850.00, status: 'Occupied', gasCompliance: 'Compliant', epcCompliance: 'Compliant' },
  { id: 'PROP-102', address: '78 Oak Avenue, Bristol BS2', landlord: 'Sarah Jenkins', rent: 1400.00, status: 'Occupied', gasCompliance: 'Compliant', epcCompliance: 'Compliant' },
  { id: 'PROP-103', address: '14 High Street, London E14', landlord: 'Robert Vance', rent: 3100.00, status: 'Occupied', gasCompliance: 'Action Required', epcCompliance: 'Compliant' },
  { id: 'PROP-104', address: 'Building C, Apartment 4B, Birmingham B3', landlord: 'Emily Carter', rent: 1200.00, status: 'Vacant', gasCompliance: 'Compliant', epcCompliance: 'Pending Renewal' },
  { id: 'PROP-105', address: '22 Queen Street, Liverpool L3', landlord: 'William Hughes', rent: 950.00, status: 'Occupied', gasCompliance: 'Compliant', epcCompliance: 'Compliant' },
];

export const Properties = () => {
  const columns = [
    { header: 'Property ID', accessor: 'id', sortable: true },
    { header: 'Address', accessor: 'address', sortable: true },
    { header: 'Associated Landlord', accessor: 'landlord', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.rent.toFixed(2)}`
    },
    { 
      header: 'Tenancy Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Occupied' 
            ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/20' 
            : 'bg-status-muted/10 text-status-muted border-status-muted/20 animate-pulse'
        }`}>
          {row.status}
        </span>
      )
    },
    { 
      header: 'Gas Certificate', 
      accessor: 'gasCompliance',
      renderCell: (row) => (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          row.gasCompliance === 'Compliant' ? 'text-status-success' : 'text-status-danger'
        }`}>
          {row.gasCompliance === 'Compliant' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {row.gasCompliance}
        </span>
      )
    },
    { 
      header: 'EPC rating', 
      accessor: 'epcCompliance',
      renderCell: (row) => (
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          row.epcCompliance === 'Compliant' ? 'text-status-success' : 'text-status-warning'
        }`}>
          {row.epcCompliance === 'Compliant' ? <CheckCircle2 size={13} /> : <HelpCircle size={13} />}
          {row.epcCompliance}
        </span>
      )
    },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Properties Portfolio</h2>
          <p className="text-sm text-gray-500 mt-1">Manage standard parameters, safety compliance certificates, and occupancies.</p>
        </div>
        <Button variant="primary" icon={Home} className="shadow-sm">
          Add New Property
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <StatCard
          label="Total Properties"
          value="86 units"
          icon={Home}
          iconColor="text-brand-primary bg-brand-primary/10"
        />
        <StatCard
          label="Occupied"
          value="82 units"
          icon={CheckCircle2}
          iconColor="text-status-success bg-status-success/10"
          valueColor="text-status-success"
        />
        <StatCard
          label="Vacant Units"
          value="4 units"
          icon={HelpCircle}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-brand-accent"
        />
        <StatCard
          label="Safety Warnings"
          value="2 Non-Compliant"
          icon={AlertTriangle}
          iconColor="text-status-danger bg-status-danger/10"
          valueColor="text-status-danger"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={propertiesData} />
      </div>
    </div>
  );
};
