import { FileText } from 'lucide-react';
import { Button } from './Button';
import { DataTable } from './DataTable';
import { Skeleton } from './Skeleton';
import { InfoTip } from './InfoTip';
import { useToast } from './ToastContext';
import api from '../../utilities/api';

// Historic statements (F62): ROCA statements from before Roca Living took over,
// re-made in Roca Living's design with the figures the bank shows. Read-only.

const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const periodLabel = (start, end) => `${new Date(start).getFullYear() === new Date(end).getFullYear() ? shortDate(start) : longDate(start)} – ${longDate(end)}`;
const gbp = (n) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONEY = 'tabular-nums whitespace-nowrap';

const openPdf = async (id, original, addToast) => {
  try {
    const res = await api.get(`/historic-statements/${id}/pdf${original ? '?original=1&inline=1' : '?inline=1'}`, { responseType: 'blob', skipInterceptorError: true });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (err) {
    let msg = 'Could not open the PDF';
    if (err.response?.data instanceof Blob) {
      try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* keep default */ }
    }
    addToast(msg, 'error');
  }
};

export const HistoricStatementsTable = ({ rows, error }) => {
  const { addToast } = useToast();
  if (rows === null) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton radius="bar" className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) {
    return <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>;
  }
  const columns = [
    {
      header: 'Statement',
      accessor: 'statement_number',
      sortable: true,
      renderCell: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-bold flex items-center gap-2">
            {r.statement_number}
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-status-muted">Historic</span>
          </div>
          <div className="text-2xs text-status-muted mt-0.5">{r.flat}{r.issued_on ? ` · Issued ${longDate(r.issued_on)}` : ''}</div>
        </div>
      )
    },
    {
      header: 'Landlord',
      accessor: 'landlord_name',
      sortable: true,
      renderCell: (r) => <span className="min-w-[140px] max-w-[260px] line-clamp-2 leading-snug" title={r.landlord_name}>{r.landlord_name || '—'}</span>
    },
    { header: 'Period', accessor: 'period_start', sortable: true, cellClassName: 'whitespace-nowrap', renderCell: (r) => periodLabel(r.period_start, r.period_end) },
    { header: 'Rent', accessor: 'total_income', align: 'right', sortable: true, cellClassName: MONEY, renderCell: (r) => gbp(r.total_income) },
    {
      header: 'Fees & Costs', accessor: 'total_expenditure', align: 'right', sortable: true, cellClassName: MONEY,
      renderCell: (r) => <span className="text-status-muted">{r.total_expenditure ? `−${gbp(r.total_expenditure)}` : gbp(0)}</span>
    },
    { header: 'Net Paid', accessor: 'net_paid', align: 'right', sortable: true, cellClassName: `${MONEY} font-bold`, renderCell: (r) => gbp(r.net_paid) },
    {
      header: 'Paid On', accessor: 'paid_on', sortable: true, cellClassName: 'whitespace-nowrap',
      renderCell: (r) => (r.paid_on ? longDate(r.paid_on) : <span className="text-status-muted">—</span>)
    },
    {
      header: '',
      accessor: 'id',
      align: 'right',
      renderCell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="secondary" size="sm" icon={FileText} onClick={() => openPdf(r.id, false, addToast)}>View PDF</Button>
          {r.has_original ? (
            <Button variant="ghost" size="sm" onClick={() => openPdf(r.id, true, addToast)} title="The client's original PDF, as it was sent">Original</Button>
          ) : (
            <span className="w-[68px]" />
          )}
        </div>
      )
    }
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-status-muted flex items-center gap-1.5">
        {rows.length} statement{rows.length === 1 ? '' : 's'} made before Roca Living took over
        <InfoTip text="Re-made in Roca Living's design with the figures the bank shows. Read-only, and not part of Generate Statement numbering." />
      </div>
      <DataTable columns={columns} data={rows} />
    </div>
  );
};
