import { useCallback, useState } from 'react';
import { Download, Trash2, Mail } from 'lucide-react';
import { Button } from './Button';
import { InfoTip } from './InfoTip';
import { StatementEmailModal } from './StatementEmailModal';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

// Statements from approved rent: the list with PDF download, Send (email to
// the landlord, same popup as the Statements page) and draft delete.
// Used on the Rent Cycle page and on the separate statements page.
export const ApprovedStatementsTable = ({ rows, onChanged, emptyText = 'No statements yet.' }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [emailFor, setEmailFor] = useState(null);
  // Stable, so the popup doesn't reload its draft (and lose edits) when the page re-renders.
  const closeEmail = useCallback(() => setEmailFor(null), []);

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
              <td className="p-3 whitespace-nowrap">
                <div className="font-semibold text-brand-primary">{s.statement_number}</div>
                {s.sent_at && (
                  <div className="text-xs text-status-success inline-flex items-center gap-1">
                    Sent {new Date(s.sent_at).toLocaleDateString('en-GB')} ✓ <InfoTip text={`Emailed to ${s.sent_to}`} />
                  </div>
                )}
              </td>
              <td className="p-3">{s.landlord_name || '—'}</td>
              <td className="p-3"><span className="whitespace-nowrap">{s.flat}</span> · {s.tenant_name || '—'}</td>
              <td className="p-3 whitespace-nowrap">{ukDate(s.period_start)} – {ukDate(s.period_end)}</td>
              <td className="p-3 text-right whitespace-nowrap">{money(s.total_rent)}</td>
              <td className="p-3 text-right whitespace-nowrap">−{money(s.total_fee)}</td>
              <td className="p-3 text-right whitespace-nowrap">{Number(s.total_deductions) > 0 ? `−${money(s.total_deductions)}` : '—'}</td>
              <td className="p-3 text-right font-semibold whitespace-nowrap">{money(s.net_payout)}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1 whitespace-nowrap">
                  <Button variant="ghost" size="sm" icon={Download} onClick={() => download(s)}>PDF</Button>
                  <Button variant={s.sent_at ? 'ghost' : 'primary'} size="sm" icon={Mail} onClick={() => setEmailFor(s.id)}>{s.sent_at ? 'Send Again' : 'Send'}</Button>
                  {s.status === 'draft' && !s.sent_at && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(s)}>Delete</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {emailFor && (
        <StatementEmailModal statementId={emailFor} basePath="/approved-statements" onClose={closeEmail} onSent={() => onChanged?.()} />
      )}
    </div>
  );
};
