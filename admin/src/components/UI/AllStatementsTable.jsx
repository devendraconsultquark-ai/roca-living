import { useCallback, useState } from 'react';
import { Download, Mail, Send, CheckCircle2, Trash2, FileText } from 'lucide-react';
import { DataTable } from './DataTable';
import { Button } from './Button';
import { StatusPill } from './StatusPill';
import { RowActionsMenu } from './RowActionsMenu';
import { StatementEmailModal } from './StatementEmailModal';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';
import { TYPE_LABEL } from '../../utilities/statementTypes';

// Every statement in one table — Roca Living (Generate Statement), Rent Cycle
// and Historic — from GET /all-statements (single source of truth). Each row
// keeps the actions of its own kind. Used on the Statements page, the Rent
// Cycle popup and the landlord / property pages.

const TYPE_STYLE = {
  roca_living: 'bg-brand-accent/10 text-brand-accent',
  rent_cycle: 'bg-status-info/10 text-status-info',
  historic: 'bg-gray-100 text-status-muted'
};
const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const periodLabel = (s, e) => (s && e ? `${new Date(s).getFullYear() === new Date(e).getFullYear() ? shortDate(s) : longDate(s)} – ${longDate(e)}` : '—');
const gbp = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONEY = 'tabular-nums whitespace-nowrap';

const blobError = async (err, fallback) => {
  if (err.response?.data instanceof Blob) {
    try { return JSON.parse(await err.response.data.text())?.message || fallback; } catch { return fallback; }
  }
  return err.response?.data?.message || fallback;
};

export const AllStatementsTable = ({ rows, onChanged, showLandlord = true, emptyText = 'No statements yet.' }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [emailFor, setEmailFor] = useState(null); // { id, basePath }
  const closeEmail = useCallback(() => setEmailFor(null), []);

  const pdf = async (r, original = false) => {
    try {
      const url = original ? `/historic-statements/${r.id}/pdf?original=1&inline=1` : `/all-statements/${r.key}/pdf?inline=1`;
      const res = await api.get(url, { responseType: 'blob', skipInterceptorError: true });
      const href = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(href, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(href), 60000);
    } catch (err) {
      addToast(await blobError(err, 'Could not open the PDF'), 'error');
    }
  };

  const setStatus = async (r, status) => {
    try {
      await api.patch(`/statements/${r.id}/status`, { status });
      addToast(`Statement ${r.statement_number} marked as ${status}`, 'success');
      onChanged?.();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update the statement', 'error');
    }
  };

  const removeDraft = async (r) => {
    const ok = await confirm({
      title: 'Delete draft statement',
      message: `Delete draft ${r.statement_number}? Its rent becomes available for a new statement.`,
      variant: 'danger',
      confirmText: 'Delete draft'
    });
    if (!ok) return;
    try {
      const res = await api.delete(r.type === 'rent_cycle' ? `/approved-statements/${r.id}` : `/statements/${r.id}`);
      addToast(res.data?.message || `Draft ${r.statement_number} deleted`, 'success');
      onChanged?.();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete the draft', 'error');
    }
  };

  // One "next step" button per row; everything else in the ⋯ menu.
  const nextStep = (r) => {
    if (r.type === 'roca_living') {
      if (r.status === 'draft') return { label: 'Email', icon: Mail, onClick: () => setEmailFor({ id: r.id, basePath: '/statements' }) };
      if (r.status === 'sent') return { label: 'Mark Paid', icon: CheckCircle2, onClick: () => setStatus(r, 'paid') };
      return null;
    }
    if (r.type === 'rent_cycle' && !r.sent_at) return { label: 'Send', icon: Mail, onClick: () => setEmailFor({ id: r.id, basePath: '/approved-statements' }) };
    if (r.type === 'historic' && r.has_original) return { label: 'Original', icon: FileText, onClick: () => pdf(r, true) };
    return null;
  };
  const menuItems = (r) => {
    const primary = nextStep(r)?.label;
    if (r.type === 'roca_living') {
      return [
        primary !== 'Email' && { label: r.sent_at ? 'Email Again' : 'Email', icon: Mail, onClick: () => setEmailFor({ id: r.id, basePath: '/statements' }) },
        r.status === 'draft' && { label: 'Mark Sent', icon: Send, onClick: () => setStatus(r, 'sent') },
        r.status !== 'paid' && primary !== 'Mark Paid' && { label: 'Mark Paid', icon: CheckCircle2, onClick: () => setStatus(r, 'paid') },
        r.status === 'draft' && !r.sent_at && { label: 'Delete Draft', icon: Trash2, danger: true, onClick: () => removeDraft(r) }
      ];
    }
    if (r.type === 'rent_cycle') {
      return [
        r.sent_at && { label: 'Send Again', icon: Mail, onClick: () => setEmailFor({ id: r.id, basePath: '/approved-statements' }) },
        r.status === 'draft' && !r.sent_at && { label: 'Delete Draft', icon: Trash2, danger: true, onClick: () => removeDraft(r) }
      ];
    }
    return [];
  };

  if (rows === null) return <p className="text-sm text-status-muted py-6 text-center">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-status-muted py-6 text-center">{emptyText}</p>;

  const columns = [
    {
      header: 'Statement',
      accessor: 'statement_number',
      sortable: true,
      renderCell: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-bold flex items-center gap-2">
            {r.statement_number}
            <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${TYPE_STYLE[r.type]}`}>{TYPE_LABEL[r.type]}</span>
          </div>
          <div className="text-2xs text-status-muted mt-0.5">{[r.flat, r.issued_on && `Issued ${longDate(r.issued_on)}`].filter(Boolean).join(' · ')}</div>
        </div>
      )
    },
    ...(showLandlord ? [{
      header: 'Landlord',
      accessor: 'landlord_name',
      sortable: true,
      renderCell: (r) => <span className="min-w-[140px] max-w-[260px] line-clamp-2 leading-snug" title={r.landlord_name}>{r.landlord_name || '—'}</span>
    }] : []),
    { header: 'Period', accessor: 'period_start', sortable: true, cellClassName: 'whitespace-nowrap', renderCell: (r) => periodLabel(r.period_start, r.period_end) },
    { header: 'Rent', accessor: 'rent', align: 'right', sortable: true, cellClassName: MONEY, renderCell: (r) => gbp(r.rent) },
    {
      header: 'Fees & Costs', accessor: 'fees', align: 'right', sortable: true, cellClassName: MONEY,
      renderCell: (r) => <span className="text-status-muted">{r.fees ? `−${gbp(r.fees)}` : gbp(0)}</span>
    },
    { header: 'Net Paid', accessor: 'net', align: 'right', sortable: true, cellClassName: `${MONEY} font-bold`, renderCell: (r) => gbp(r.net) },
    {
      header: <span className="pl-4">Status</span>,
      accessor: 'status',
      sortable: true,
      renderCell: (r) => {
        const note = r.status === 'paid' && r.paid_on ? `Paid ${shortDate(r.paid_on)}` : r.sent_at ? `Emailed ${shortDate(r.sent_at)}` : null;
        return (
          <div className="flex flex-col items-start gap-1 pl-4">
            <StatusPill status={r.status} size="sm" showIcon={false} />
            {note && <span className="text-2xs text-status-muted whitespace-nowrap">{note}</span>}
            {r.xero_bill_number && <span className="text-2xs text-status-muted whitespace-nowrap" title="Landlord bill in Xero">{r.xero_bill_number}</span>}
          </div>
        );
      }
    },
    {
      header: '',
      accessor: 'key',
      align: 'right',
      width: 190,
      cellClassName: '',
      renderCell: (r) => {
        const step = nextStep(r);
        const items = menuItems(r).filter(Boolean);
        return (
          <div className="flex items-center justify-end gap-0.5">
            <div className="w-[100px] mr-1 flex justify-end">
              {step && <Button variant="secondary" size="sm" icon={step.icon} onClick={step.onClick} className="w-full">{step.label}</Button>}
            </div>
            <button type="button" title="View PDF" aria-label="View PDF" onClick={() => pdf(r)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-card text-ink-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer">
              <Download size={15} />
            </button>
            {items.length ? <RowActionsMenu items={items} /> : <span className="w-8" />}
          </div>
        );
      }
    }
  ];

  return (
    <>
      <DataTable columns={columns} data={rows} />
      {emailFor && <StatementEmailModal statementId={emailFor.id} basePath={emailFor.basePath} onClose={closeEmail} onSent={() => onChanged?.()} />}
    </>
  );
};
