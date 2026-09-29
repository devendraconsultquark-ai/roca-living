import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Send, CheckCircle2, Mail, Trash2 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { StatusPill } from '../components/UI/StatusPill';
import { RowActionsMenu } from '../components/UI/RowActionsMenu';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Skeleton } from '../components/UI/Skeleton';
import { TenantStatementModal } from '../components/UI/TenantStatementModal';
import { StatementEmailModal } from '../components/UI/StatementEmailModal';
import api from '../utilities/api';

// "24 Sep 2026" / "24 Sep"
const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// "25 Sep – 24 Oct 2026" (the year once when both dates share it).
const periodLabel = (start, end) => {
  if (!start || !end) return '—';
  const sameYear = new Date(start).getFullYear() === new Date(end).getFullYear();
  return `${sameYear ? shortDate(start) : longDate(start)} – ${longDate(end)}`;
};

const gbp = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONEY = 'tabular-nums whitespace-nowrap';

export const Statements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Generate-statement form (select tenant → autofill → check → generate)
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statements');
      const formatted = (response.data?.data || []).map((s) => {
        // Real money out of the statement: expense deductions + NRL withholding.
        // (The mgmt_fee/letting-fee columns are always 0 in this statement format.)
        const totalDeductions = parseFloat(s.deductions || 0) + parseFloat(s.nrl_withheld || 0);

        return {
          id: s.id,
          // The statement number (PH_33_0004) is what ROCA and the landlord see on the PDF.
          statement_reference: s.statement_number || s.statement_reference || `STM-${s.id}`,
          landlord: s.landlord_name || 'Landlord',
          period: periodLabel(s.period_start, s.period_end),
          periodSort: s.period_start ? new Date(s.period_start).getTime() : null,
          date: s.generated_at ? longDate(s.generated_at) : '—',
          invoiced: parseFloat(s.gross_rent || 0),
          fees: totalDeductions,
          payout: parseFloat(s.net_paid || 0),
          rawStatus: (s.status || 'draft').toLowerCase(),
          number: s.statement_number || null,
          hasInvoice: !!s.invoice_id,
          landlordEmail: s.landlord_email || '',
          sentAt: s.sent_at ? shortDate(s.sent_at) : null,
          sentTo: s.sent_to || null,
          paidAt: s.paid_at ? shortDate(s.paid_at) : null,
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

  // Emails the statement PDF to the landlord and marks it Sent.
  // Email draft window (review, edit, then send with the PDF attached).
  const [emailFor, setEmailFor] = useState(null);

  // A draft that was never sent can be deleted (e.g. generated with the wrong
  // number); its rent money and expenses go back for the next statement.
  const handleDeleteDraft = async (row) => {
    const ok = await confirm({
      title: 'Delete draft statement',
      message: `Delete draft ${row.statement_reference} and its invoice? The rent and expenses on it become available for the next statement.`,
      variant: 'danger',
      confirmText: 'Delete draft',
    });
    if (!ok) return;
    try {
      await api.delete(`/statements/${row.id}`);
      addToast(`Draft ${row.statement_reference} deleted`, 'success');
      fetchStatements();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete the draft', 'error');
    }
  };

  const handleDownload = async (id, landlord, row) => {
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
      // ROCA's own file name: "RL_Statement PH_19_0002_INV_PH_19_0002.pdf"
      link.setAttribute('download', row?.number
        ? `RL_Statement ${row.number}${row.hasInvoice ? `_INV_${row.number}` : ''}.pdf`
        : `RL_STMT_${id}_${(landlord || 'statement').replace(/\s+/g, '_')}.pdf`);
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

  // One "next step" button per row (fixed width so every row lines up); all
  // other actions sit in the ⋯ menu.
  const nextStep = (row) => {
    if (row.rawStatus === 'draft') return { label: 'Email', icon: Mail, onClick: () => setEmailFor(row.id) };
    if (row.rawStatus === 'sent') return { label: 'Mark Paid', icon: CheckCircle2, onClick: () => handleStatusChange(row, 'paid') };
    return null;
  };

  const menuItems = (row) => {
    const primary = nextStep(row)?.label;
    return [
      primary !== 'Email' && { label: row.sentAt ? 'Email again' : 'Email', icon: Mail, onClick: () => setEmailFor(row.id) },
      row.rawStatus === 'draft' && { label: 'Mark Sent', icon: Send, onClick: () => handleStatusChange(row, 'sent') },
      (row.rawStatus === 'draft' || row.rawStatus === 'sent') && primary !== 'Mark Paid' && {
        label: 'Mark Paid', icon: CheckCircle2, onClick: () => handleStatusChange(row, 'paid')
      },
      row.rawStatus === 'draft' && !row.sentAt && { label: 'Delete draft', icon: Trash2, danger: true, onClick: () => handleDeleteDraft(row) }
    ];
  };

  const columns = [
    {
      header: 'Statement',
      accessor: 'statement_reference',
      sortable: true,
      renderCell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-bold">{row.statement_reference}</div>
          <div className="text-2xs text-status-muted mt-0.5">Issued {row.date}</div>
        </div>
      )
    },
    {
      header: 'Landlord',
      accessor: 'landlord',
      sortable: true,
      renderCell: (row) => (
        <span className="min-w-[140px] max-w-[260px] line-clamp-2 leading-snug" title={row.landlord}>{row.landlord}</span>
      )
    },
    {
      header: 'Period',
      accessor: 'period',
      sortable: true,
      sortValue: (row) => row.periodSort,
      cellClassName: 'whitespace-nowrap',
    },
    {
      header: 'Rent',
      accessor: 'invoiced',
      align: 'right',
      sortable: true,
      cellClassName: MONEY,
      renderCell: (row) => gbp(row.invoiced)
    },
    {
      header: 'Deductions',
      accessor: 'fees',
      align: 'right',
      sortable: true,
      cellClassName: MONEY,
      renderCell: (row) => <span className="text-status-muted">{row.fees ? `−${gbp(row.fees)}` : gbp(0)}</span>
    },
    {
      header: 'Payout',
      accessor: 'payout',
      align: 'right',
      sortable: true,
      cellClassName: `${MONEY} font-bold`,
      renderCell: (row) => gbp(row.payout)
    },
    {
      header: <span className="pl-4">Status</span>,
      accessor: 'status',
      sortable: true,
      renderCell: (row) => {
        const notes = [row.sentAt && `Emailed ${row.sentAt}`, row.rawStatus === 'paid' && row.paidAt && `Paid ${row.paidAt}`].filter(Boolean);
        return (
          <div className="flex flex-col items-start gap-1 pl-4">
            <StatusPill status={row.rawStatus} size="sm" showIcon={false} />
            {notes.length > 0 && <span className="text-2xs text-status-muted whitespace-nowrap">{notes.join(' · ')}</span>}
          </div>
        );
      }
    },
    {
      header: '',
      accessor: 'id',
      align: 'right',
      width: 190,
      cellClassName: '',
      renderCell: (row) => {
        const step = nextStep(row);
        return (
          <div className="flex items-center justify-end gap-0.5">
            <div className="w-[100px] mr-1 flex justify-end">
              {step && (
                <Button variant="secondary" size="sm" icon={step.icon} onClick={step.onClick} className="w-full">
                  {step.label}
                </Button>
              )}
            </div>
            <button
              type="button"
              title="Download PDF"
              aria-label="Download PDF"
              onClick={() => handleDownload(row.id, row.landlord, row)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-card text-ink-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Download size={15} />
            </button>
            <RowActionsMenu items={menuItems(row)} />
          </div>
        );
      }
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

      {emailFor && (
        <StatementEmailModal statementId={emailFor} onClose={() => setEmailFor(null)} onSent={fetchStatements} />
      )}
      {showModal && (
        <TenantStatementModal onClose={() => setShowModal(false)} onGenerated={fetchStatements} />
      )}
    </div>
  );
};
