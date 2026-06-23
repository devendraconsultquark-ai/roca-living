import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const Statements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statements/my');
      const formatted = (response.data.data || []).map((s) => {
        const totalFees = parseFloat(s.mgmt_fee || 0) + 
                          parseFloat(s.mgmt_fee_vat || 0) + 
                          parseFloat(s.roca_letting_fee || 0) + 
                          parseFloat(s.agent_letting_fee || 0);

        const periodStartStr = s.period_start ? new Date(s.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = s.period_end ? new Date(s.period_end).toLocaleDateString('en-GB') : '';

        return {
          id: s.id,
          period: `${periodStartStr} - ${periodEndStr}`,
          date: s.generated_at ? new Date(s.generated_at).toLocaleDateString('en-GB') : '-',
          invoiced: parseFloat(s.gross_rent || 0),
          fees: totalFees,
          payout: parseFloat(s.net_paid || 0),
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Draft'
        };
      });
      setStatements(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error loading statements';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleDownloadPDF = async (id, period) => {
    addToast(`Requesting statement PDF for ${period}...`, 'info');
    try {
      const response = await api.get(`/statements/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ROCA_Statement_${period.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast(`Statement PDF downloaded for ${period}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to download statement PDF for ${period}`, 'error');
    }
  };

  const columns = [
    { header: 'Statement ID', accessor: 'id', sortable: true },
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
      header: 'Deductions (Fees)', 
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
      renderCell: (row) => {
        let style = 'bg-status-warning/10 text-status-warning border-status-warning/20';
        if (row.status === 'Paid' || row.status === 'Sent') {
          style = 'bg-status-success/10 text-status-success border-status-success/20';
        }
        return (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${style}`}>
            {row.status}
          </span>
        );
      }
    },
    {
      header: 'Statement PDF',
      accessor: 'id',
      renderCell: (row) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleDownloadPDF(row.id, row.period)}
          icon={Download}
        >
          Download PDF
        </Button>
      )
    }
  ];

  return (
    <div className="py-6 flex flex-col gap-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Statements Library</h2>
        <p className="text-sm text-gray-500 mt-1">Review historical payout amounts, agency deductions, and download tax statements.</p>
      </div>

      {/* Table grid container */}
      <div className="bg-white rounded-2xl border border-border-color p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger bg-status-danger/5 rounded-xl p-6 text-center text-status-danger font-semibold">
            {error}
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={statements} 
            initialPageSize={10}
          />
        )}
      </div>
    </div>
  );
};
