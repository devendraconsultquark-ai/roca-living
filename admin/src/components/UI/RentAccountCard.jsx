import { Download } from 'lucide-react';
import { Card } from './DetailComponents';
import { Button } from './Button';
import { gbp, shortDate } from '../../utilities/designTokens';
import { downloadCsv } from '../../utilities/csv';

// The tenancy's rent account month by month: what fell due, which payments
// paid it, and what is still owed. Its balance is the one on the Tenants list.
// account: rent_account from GET /tenancies/tenants/:id.
export const RentAccountCard = ({ account, fileName = 'rent-account' }) => {
  if (!account) return null;
  const { months, payments, totals } = account;
  const balance = parseFloat(totals.balance);
  const owedNow = months.filter((m) => m.fallen_due).reduce((t, m) => t + parseFloat(m.owed), 0);
  const credit = Math.max(0, Math.round((balance + owedNow) * 100) / 100);

  // "Owed so far": unpaid rent of every month due up to and including this one.
  const rows = months.reduce((acc, m) => {
    const before = acc.length ? (acc[acc.length - 1].total || 0) : 0;
    const total = m.fallen_due ? before + parseFloat(m.owed) : before;
    return [...acc, { ...m, total, running: m.fallen_due ? total : null }];
  }, []);

  const exportCsv = () => downloadCsv(`${fileName}.csv`, rows, [
    { key: 'due_date', label: 'Due date' },
    { key: (r) => `${r.due_date} to ${r.period_end}`, label: 'Rent period' },
    { key: 'amount', label: 'Rent' },
    { key: 'paid', label: 'Paid' },
    { key: 'owed', label: 'Still owed' },
    { key: (r) => (r.running === null ? 'not due yet' : r.running.toFixed(2)), label: 'Owed so far' },
    { key: (r) => r.paid_by.map((p) => `${p.received_at} £${p.amount}`).join('; '), label: 'Paid by' },
    { key: (r) => r.statement_numbers.join(' '), label: 'Statement' },
  ]);

  const summary = totals.months_due
    ? `${totals.months_due} rent month${totals.months_due === 1 ? '' : 's'} due since ${shortDate(totals.first_due)}: ${gbp(totals.rent_due_to_date)} due, ${gbp(totals.received)} received.`
    : 'No rent has fallen due yet.';

  return (
    <Card title="Rent account">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-brand-primary">
          {summary}{' '}
          <b className={balance < 0 ? 'text-status-danger' : 'text-status-success'}>
            {balance < 0 ? `${gbp(Math.abs(balance))} owed` : balance > 0 ? `${gbp(balance)} in credit` : 'Nothing owed'}
          </b>
          {credit > 0 && balance < 0 && <span className="text-status-muted"> ({gbp(credit)} received but not yet used for a month)</span>}
        </p>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-status-muted">No rent months yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] font-bold text-status-muted border-b border-card-border">
                <th className="py-2 px-1">Rent period</th>
                <th className="py-2 px-1 text-right">Rent</th>
                <th className="py-2 px-1 text-right">Paid</th>
                <th className="py-2 px-1 text-right">Still owed</th>
                <th className="py-2 px-1 text-right">Owed so far</th>
                <th className="py-2 px-1">Paid by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const owed = parseFloat(r.owed);
                const tone = !r.fallen_due ? 'text-gray-400' : owed > 0 ? 'text-status-danger' : 'text-brand-primary';
                return (
                  <tr key={r.due_date} className={`border-b border-card-border/60 last:border-0 ${tone} ${r.fallen_due && owed > 0 ? 'bg-status-danger-bg/40' : ''}`}>
                    <td className="py-2 px-1 whitespace-nowrap">
                      {shortDate(r.due_date)} – {shortDate(r.period_end)}
                      {!r.fallen_due && <span className="ml-2 text-[11px]">not due yet</span>}
                      {r.statement_numbers.length > 0 && <span className="ml-2 text-[11px] text-status-muted">{r.statement_numbers.join(', ')}</span>}
                    </td>
                    <td className="py-2 px-1 text-right tabular-nums">{gbp(r.amount)}</td>
                    <td className="py-2 px-1 text-right tabular-nums">{gbp(r.paid)}</td>
                    <td className="py-2 px-1 text-right tabular-nums font-semibold">{gbp(r.owed)}</td>
                    <td className="py-2 px-1 text-right tabular-nums">{r.running === null ? '—' : gbp(r.running)}</td>
                    <td className="py-2 px-1 text-[12px]">
                      {r.paid_by.length ? r.paid_by.map((p) => `${shortDate(p.received_at)} ${gbp(p.amount)}`).join(', ') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {payments.length === 0 && totals.months_due > 0 && (
        <p className="text-xs text-status-muted mt-3">
          No payments recorded. Rent paid before Roca Living? Set <b>Rent Handled in Roca Living From</b> in Edit Tenant.
        </p>
      )}
    </Card>
  );
};
