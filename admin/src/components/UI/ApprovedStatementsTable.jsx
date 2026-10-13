import { Download, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

// Statements from approved rent: the list with PDF download and draft delete.
// Used on the Rent Cycle page and on the separate statements page.
export const ApprovedStatementsTable = ({ rows, onChanged, emptyText = 'No statements yet.' }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();

  const download = async (s) => {
    try {
      const res = await api.get(`/approved-statements/${s.id}/pdf`, { responseType: 'blob', skipInterceptorError: true });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `RL_${s.statement_number}${s.invoice_number ? `_${s.invoice_number}` : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Failed to download the PDF', 'error');
    }
  };

  const remove = async (s) => {
    const ok = await confirm({
      title: 'Delete statement',
      message: `Delete ${s.statement_number}? Its approved rent becomes available for a new statement.`,
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/approved-statements/${s.id}`);
      addToast(res.data.message, 'success');
      onChanged?.();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  if (rows === null) return <p className="text-sm text-status-muted py-6 text-center">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-status-muted py-6 text-center">{emptyText}</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-card-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-status-muted border-b border-card-border">
            <th className="p-3">Statement</th>
            <th className="p-3">Landlord</th>
            <th className="p-3">Flat</th>
            <th className="p-3">Period</th>
            <th className="p-3 text-right">Rent</th>
            <th className="p-3 text-right">Fee</th>
            <th className="p-3 text-right">Deductions</th>
            <th className="p-3 text-right">To landlord</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-card-border/60 last:border-0">
              <td className="p-3 font-semibold text-brand-primary whitespace-nowrap">{s.statement_number}</td>
              <td className="p-3">{s.landlord_name || '—'}</td>
              <td className="p-3">{s.flat} · {s.tenant_name || '—'}</td>
              <td className="p-3 whitespace-nowrap">{ukDate(s.period_start)} – {ukDate(s.period_end)}</td>
              <td className="p-3 text-right">{money(s.total_rent)}</td>
              <td className="p-3 text-right">−{money(s.total_fee)}</td>
              <td className="p-3 text-right">{Number(s.total_deductions) > 0 ? `−${money(s.total_deductions)}` : '—'}</td>
              <td className="p-3 text-right font-semibold">{money(s.net_payout)}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" icon={Download} onClick={() => download(s)}>PDF</Button>
                  {s.status === 'draft' && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(s)}>Delete</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
