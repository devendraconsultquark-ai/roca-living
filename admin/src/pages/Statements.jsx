import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Send, CheckCircle2 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { useToast } from '../components/UI/ToastContext';
import { Skeleton } from '../components/UI/Skeleton';
import { TenantStatementModal } from '../components/UI/TenantStatementModal';
import api from '../utilities/api';

export const Statements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Generate-statement form (select tenant → autofill → check → generate)
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useToast();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statements');
      const formatted = (response.data?.data || []).map((s) => {
        // Real money out of the statement: expense deductions + NRL withholding.
        // (The mgmt_fee/letting-fee columns are always 0 in this statement format.)
        const totalDeductions = parseFloat(s.deductions || 0) + parseFloat(s.nrl_withheld || 0);

        const periodStartStr = s.period_start ? new Date(s.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = s.period_end ? new Date(s.period_end).toLocaleDateString('en-GB') : '';

        return {
          id: s.id,
          // The statement number (PH_33_0004) is what ROCA and the landlord see on the PDF.
          statement_reference: s.statement_number || s.statement_reference || `STM-${s.id}`,
          landlord: s.landlord_name || 'Landlord',
          period: `${periodStartStr} - ${periodEndStr}`,
          date: s.generated_at ? new Date(s.generated_at).toLocaleDateString('en-GB') : '-',
          invoiced: parseFloat(s.gross_rent || 0),
          fees: totalDeductions,
          payout: parseFloat(s.net_paid || 0),
          rawStatus: (s.status || 'draft').toLowerCase(),
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Draft'
        };
      });
      setStatements(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error loading statements');
      setStatements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleDownload = async (id, landlord) => {
    try {
      addToast(`Preparing download for Statement #${id}...`, 'info');
      const response = await api.get(`/statements/${id}/pdf`, {
        responseType: 'blob',
        skipInterceptorError: true
      });
      // Check if server returned an error disguised as blob (e.g. JSON error in blob form)
      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        // Try to read error message from blob
        const text = await response.data.text();
        let msg = 'Failed to download statement PDF';
        try { msg = JSON.parse(text)?.message || msg; } catch {}
        addToast(msg, 'error');
        return;
      }
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RL_STMT_${id}_${(landlord || 'statement').replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast(`Downloaded Statement successfully`, 'success');
    } catch (err) {
      console.error(err);
      let msg = 'Failed to download statement PDF';
      // err.response.data may be a Blob for blob requests
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          msg = JSON.parse(text)?.message || msg;
        } catch {}
      } else {
        msg = err.response?.data?.message || err.message || msg;
      }
      addToast(msg, 'error');
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.patch(`/statements/${row.id}/status`, { status: newStatus });
      addToast(`Statement ${row.statement_reference} marked as ${newStatus}`, 'success');
      fetchStatements();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update statement status', 'error');
    }
  };

  const columns = [
    { header: 'Statement Reference', accessor: 'statement_reference', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    { header: 'Billing Period', accessor: 'period', sortable: true },
    { header: 'Issue Date', accessor: 'date', sortable: true },
    { 
      header: 'Rent Invoiced', 
      accessor: 'invoiced', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.invoiced.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      header: 'Deductions',
      accessor: 'fees',
      align: 'right',
      sortable: true,
      renderCell: (row) => `-£${row.fees.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { 
      header: 'Net Payout', 
      accessor: 'payout', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-brand-primary">
          £{row.payout.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      header: 'Payout Status',
      accessor: 'status',
      renderCell: (row) => {
        let style = 'bg-surface-hover text-gray-400 border-card-border';
        if (row.status === 'Paid') {
          style = 'bg-status-success-bg text-status-success border-status-success/15';
        } else if (row.status === 'Sent') {
          style = 'bg-status-info-bg text-status-info border-status-info/15';
        }
        return (
          <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${style}`}>
            {row.status}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      renderCell: (row) => (
        <div className="flex items-center gap-1">
          {row.rawStatus === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange(row, 'sent')}
              icon={Send}
            >
              Mark Sent
            </Button>
          )}
          {(row.rawStatus === 'draft' || row.rawStatus === 'sent') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange(row, 'paid')}
              icon={CheckCircle2}
            >
              Mark Paid
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(row.id, row.landlord)}
            icon={Download}
          >
            PDF
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          icon={FileSpreadsheet}
        >
          Generate Statement
        </Button>
      </div>

      {/* Grid container */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">
            {error}
          </div>
        ) : (
          <DataTable columns={columns} data={statements} />
        )}
      </div>

      {showModal && (
        <TenantStatementModal onClose={() => setShowModal(false)} onGenerated={fetchStatements} />
      )}
    </div>
  );
};
