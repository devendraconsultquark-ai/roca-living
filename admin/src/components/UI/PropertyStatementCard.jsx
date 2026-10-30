import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { SectionCard, KeyValues } from './DesignKit';
import { DatePicker } from './DatePicker';
import { Button } from './Button';
import { useToast } from './ToastContext';
import api from '../../utilities/api';
import { gbp, shortDate } from '../../utilities/designTokens';

// Property statement for any From–To range (up to 12 months), like PayProp's:
// income and expenses, tenant account, fees and costs, owner summary and cash
// flow. Read-only; the PDF is made on the server.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const defaultRange = () => {
  const now = new Date();
  return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: ymd(now) };
};
const signed = (n) => (n < 0 ? `-${gbp(Math.abs(n))}` : gbp(n));

const Table = ({ head, rows, total }) => (
  <div className="overflow-x-auto border border-card-border rounded-lg">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-surface-light text-gray-500">
          {head.map((h) => <th key={h.t} className={`px-3 py-2 font-semibold ${h.left ? 'text-left' : 'text-right'}`}>{h.t}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-3 text-gray-400">Nothing in this period</td></tr>}
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-card-border/60">
            {r.map((c, j) => <td key={j} className={`px-3 py-2 ${head[j].left ? 'text-left text-brand-primary' : 'text-right tabular-nums whitespace-nowrap'}`}>{c}</td>)}
          </tr>
        ))}
        {total && (
          <tr className="border-t border-card-border bg-surface-light font-bold">
            {total.map((c, j) => <td key={j} className={`px-3 py-2 ${head[j].left ? 'text-left' : 'text-right tabular-nums whitespace-nowrap'}`}>{c}</td>)}
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export const PropertyStatementCard = ({ propertyId, unit }) => {
  const { addToast } = useToast();
  const [range, setRange] = useState(defaultRange);
  const [detail, setDetail] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null); // 'view' | 'pdf'

  const params = { property_id: propertyId, from: range.from, to: range.to };
  const errorOf = async (err, fallback) => {
    const body = err.response?.data;
    if (body instanceof Blob) { try { return JSON.parse(await body.text())?.message || fallback; } catch { return fallback; } }
    return body?.message || fallback;
  };

  const view = async () => {
    setBusy('view');
    try {
      const res = await api.get('/reports/property-statement', { params, skipInterceptorError: true });
      setData(res.data.data);
    } catch (err) {
      addToast(await errorOf(err, 'Could not make the property statement'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('pdf');
    try {
      const res = await api.get('/reports/property-statement', {
        params: { ...params, format: 'pdf', ...(detail ? { detail: 1 } : {}) },
        responseType: 'blob',
        skipInterceptorError: true,
      });
      const name = `Property_statement_${unit ? `${String(unit).replace(/[^A-Za-z0-9-]+/g, '_')}_` : ''}${range.from}_to_${range.to}.pdf`;
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      addToast(await errorOf(err, 'Could not download the property statement'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const ie = data?.income_expenses;
  return (
    <SectionCard title="Property statement" sub="Any period up to 12 months: income and expenses, tenant account, owner summary and cash flow.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44"><DatePicker id="psFrom" label="From" value={range.from} onChange={(v) => { setRange((r) => ({ ...r, from: v })); setData(null); }} size="sm" /></div>
        <div className="w-44"><DatePicker id="psTo" label="To" min={range.from || null} value={range.to} onChange={(v) => { setRange((r) => ({ ...r, to: v })); setData(null); }} size="sm" /></div>
        <div className="flex border border-card-border rounded-lg overflow-hidden text-xs font-bold">
          {[['Summary', false], ['Detail', true]].map(([label, value]) => (
            <button key={label} type="button" onClick={() => setDetail(value)}
              className={`px-3 py-2 cursor-pointer ${detail === value ? 'bg-brand-accent text-white' : 'text-status-muted hover:bg-surface-hover'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={Eye} onClick={view} disabled={!!busy}>{busy === 'view' ? 'Loading…' : 'View'}</Button>
        <Button variant="accent" size="sm" icon={Download} onClick={download} disabled={!!busy}>{busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</Button>
      </div>

      {data && (
        <div className="flex flex-col gap-5 mt-2">
          <div>
            <p className="text-xs font-bold text-brand-primary mb-2">Income and expenses · {shortDate(data.period.from)} – {shortDate(data.period.to)}</p>
            <Table
              head={[{ t: detail ? 'Date · Type' : 'Type', left: true }, { t: 'Description', left: true }, { t: 'VAT' }, { t: 'Income' }, { t: 'Expenditure' }, { t: 'Net return' }]}
              rows={(detail ? ie.detail : ie.lines).map((l) => [
                detail ? `${shortDate(l.date)} · ${l.type}` : l.type, l.description, gbp(l.vat), gbp(l.income), signed(-l.expenditure), signed(l.income - l.expenditure),
              ])}
              total={['Total', '', gbp(ie.total_vat), gbp(ie.total_income), signed(-ie.total_expenditure), signed(ie.net_return)]}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <p className="text-xs font-bold text-brand-primary mb-2">Tenant account</p>
              <KeyValues rows={[
                ['Opening balance', signed(data.debtor.opening)],
                ['Rent due', gbp(data.debtor.rent_invoiced)],
                ['Payments received', signed(-data.debtor.payments_received)],
                ['Owed by tenant', signed(data.debtor.closing), data.debtor.closing > 0 ? 'red' : 'green', true],
              ]} />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-primary mb-2">Fees and costs</p>
              <KeyValues rows={[
                ['ROCA Living fees', signed(-data.creditor.fees_charged)],
                ['Costs', signed(-data.creditor.costs_charged)],
                ['Paid from rent', gbp(data.creditor.payments_made)],
                ['Balance due', gbp(data.creditor.closing), null, true],
              ]} />
            </div>
            <div>
              <p className="text-xs font-bold text-brand-primary mb-2">Owner summary</p>
              <KeyValues rows={[
                ['Opening balance', signed(data.owner_summary.opening)],
                ['Return for period', signed(data.owner_summary.return_for_period)],
                ['Paid to owner', signed(-data.owner_summary.paid_to_owner)],
                ['Held for owner', signed(data.owner_summary.closing), null, true],
              ]} />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-brand-primary mb-2">Cash flow</p>
            <Table
              head={[{ t: 'Date', left: true }, { t: 'Type', left: true }, { t: 'Description', left: true }, { t: 'Received' }, { t: 'Paid' }, { t: 'Balance' }]}
              rows={[
                [shortDate(data.period.from), 'Opening balance', '', '', '', signed(data.cash_flow.opening)],
                ...data.cash_flow.lines.map((f) => [shortDate(f.date), f.type, f.description, f.received ? gbp(f.received) : '', f.paid ? gbp(f.paid) : '', signed(f.balance)]),
              ]}
              total={[shortDate(data.period.to), 'Closing balance', '', '', '', signed(data.cash_flow.closing)]}
            />
          </div>
          <p className="text-[11px] text-gray-400 font-semibold">{data.notes.join(' ')}</p>
        </div>
      )}
    </SectionCard>
  );
};
