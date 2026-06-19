import React from 'react';
import { ShieldAlert, Briefcase } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatCard } from '../components/UI/StatCard';

const agentsData = [
  { id: 'AGT-001', name: 'Harvey Specter', email: 'harvey@rocaliving.com', role: 'Senior Portfolio Manager', branch: 'Manchester Central', activeProperties: 34 },
  { id: 'AGT-002', name: 'Donna Paulsen', email: 'donna@rocaliving.com', role: 'Tenant Relations Director', branch: 'Manchester Central', activeProperties: 28 },
  { id: 'AGT-003', name: 'Mike Ross', email: 'mike@rocaliving.com', role: 'Compliance Officer', branch: 'Bristol Branch', activeProperties: 14 },
  { id: 'AGT-004', name: 'Rachel Zane', email: 'rachel@rocaliving.com', role: 'Onboarding Specialist', branch: 'London East', activeProperties: 10 },
];

export const Agents = () => {
  const columns = [
    { header: 'Agent ID', accessor: 'id', sortable: true },
    { header: 'Agent Name', accessor: 'name', sortable: true },
    { header: 'Email Address', accessor: 'email', sortable: true },
    { header: 'Staff Role', accessor: 'role', sortable: true },
    { header: 'Assigned Branch', accessor: 'branch', sortable: true },
    { 
      header: 'Managed Units', 
      accessor: 'activeProperties', 
      align: 'center', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded text-xs">
          {row.activeProperties}
        </span>
      )
    },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Letting Agents</h2>
          <p className="text-sm text-gray-500 mt-1">Review internal staff portfolios, active roles, branches, and client managers.</p>
        </div>
        <Button variant="primary" icon={Briefcase} className="shadow-sm">
          Register Staff Member
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          label="Active Letting Staff"
          value="8 Agents"
          icon={Briefcase}
          iconColor="text-brand-primary bg-brand-primary/10"
        />
        <StatCard
          label="Branch Locations"
          value="3 Active Offices"
          icon={ShieldAlert}
          iconColor="text-brand-accent bg-brand-accent/10"
          valueColor="text-brand-accent"
        />
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={agentsData} />
      </div>
    </div>
  );
};
