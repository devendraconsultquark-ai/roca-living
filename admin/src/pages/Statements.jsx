import React from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { useToast } from '../components/UI/ToastContext';

const statementsData = [
  { id: 'ST-0901', landlord: 'John Doe', period: 'May 2026', invoiced: 5500.00, fees: 660.00, payout: 4840.00, date: '2026-05-31', status: 'Paid' },
  { id: 'ST-0902', landlord: 'Sarah Jenkins', period: 'May 2026', invoiced: 4500.00, fees: 540.00, payout: 3960.00, date: '2026-05-31', status: 'Paid' },
  { id: 'ST-0882', landlord: 'Robert Vance', period: 'Apr 2026', date: '2026-04-30', invoiced: 12500.00, fees: 1500.00, payout: 11000.00, status: 'Paid' },
  { id: 'ST-0761', landlord: 'William Hughes', period: 'Mar 2026', date: '2026-03-31', invoiced: 8500.00, fees: 1020.00, payout: 7480.00, status: 'Paid' },
];

export const Statements = () => {
  const { addToast } = useToast();

  const handleDownload = (id, landlord) => {
    addToast(`Downloading Statement ${id} for ${landlord} (Mock)`, 'success');
  };

  const columns = [
    { header: 'Statement ID', accessor: 'id', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    { header: 'Billing Period', accessor: 'period', sortable: true },
    { header: 'Issue Date', accessor: 'date', sortable: true },
    { 
      header: 'Rent Invoiced', 
      accessor: 'invoiced', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.invoiced.toFixed(2)}`
    },
    { 
      header: 'Agency Fees', 
      accessor: 'fees', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `-£${row.fees.toFixed(2)}`
    },
    { 
      header: 'Net Payout', 
      accessor: 'payout', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-[#1A1A1A]">
          £{row.payout.toFixed(2)}
        </span>
      )
    },
    { 
      header: 'Payout Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-status-success/10 text-status-success border-status-success/20">
          {row.status}
        </span>
      )
    },
    {
      header: 'Download',
      accessor: 'id',
      renderCell: (row) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleDownload(row.id, row.landlord)}
          icon={Download}
        >
          Download PDF
        </Button>
      )
    }
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Landlord Statements Library</h2>
        <p className="text-sm text-gray-500 mt-1">Audit, export, and review statements issued to landlord partners.</p>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        <DataTable columns={columns} data={statementsData} />
      </div>
    </div>
  );
};
