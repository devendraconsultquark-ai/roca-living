import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Percent, FileText, X, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { ApprovedStatementsTable } from '../components/UI/ApprovedStatementsTable';
import api from '../utilities/api';
import { InfoTip } from '../components/UI/InfoTip';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
const shiftMonth = (ym, by) => {
  const d = new Date(`${ym}-01T00:00:00`);
  d.setMonth(d.getMonth() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const agoText = (iso) => {
  if (!iso) return 'not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STAGES = [
  { id: 'waiting', label: 'Waiting for rent', tone: 'bg-surface-hover text-status-muted' },
  { id: 'to_approve', label: 'To approve', tone: 'bg-status-info-bg text-status-info' },
  { id: 'pay_landlord', label: 'Pay landlord', tone: 'bg-status-warning/10 text-status-warning' },
  { id: 'landlord_paid', label: 'Landlord paid', tone: 'bg-status-success-bg text-status-success' },
  { id: 'statement', label: 'Done', tone: 'bg-status-success-bg text-status-success' },
  { id: 'attention', label: 'Needs a look', tone: 'bg-status-danger/10 text-status-danger' },
];
const stageInfo = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const emptyDeduction = () => ({ description: '', supplier: '', amount: '' });

// Accounting → Rent Cycle: each managed flat's rent for the month, from "waiting
// for rent" to "done", with the one thing to do next on each row. Xero is
// checked automatically when the page opens (and every 30 minutes).
export const RentCycle = () => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(null);
  const [feeFor, setFeeFor] = useState(null); // { row, fee_pct, reason }
  // Approve popup: deductions (cleaning, repairs…) before the landlord bill goes to Xero
  const [approveFor, setApproveFor] = useState(null); // { row, paymentId, items, saved, max, loading }
  // Statements from approved rent, shown in the View statements popup (this month, or all)
  const [showStatements, setShowStatements] = useState(false);
  const [statements, setStatements] = useState(null);
  const [allMonths, setAllMonths] = useState(false);
  const [showHelp, setShowHelp] = useState(() => {
    try { return localStorage.getItem('rentCycleHelp') !== 'hidden'; } catch { return true; }
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/xero/rent-cycle', { params: { month }, skipInterceptorError: true });
      setData(res.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load the rent cycle', 'error');
      setData({ rows: [], counts: {}, landlord_totals: [] });
    }
  }, [month, addToast]);

  const loadStatements = useCallback(async () => {
    try {
      const res = await api.get('/approved-statements', { params: allMonths ? {} : { month }, skipInterceptorError: true });
      setStatements(res.data.data);
    } catch {
      setStatements([]);
    }
  }, [month, allMonths]);

  useEffect(() => { if (showStatements) Promise.resolve().then(loadStatements); }, [showStatements, loadStatements]);

  const checkXero = useCallback(async (force = false, quiet = false) => {
    setChecking(true);
    try {
      const res = await api.post('/xero/rent-cycle/refresh', { force }, { skipInterceptorError: true });
      if (!quiet) addToast(res.data.message, 'success');
    } catch (err) {
      if (!quiet) addToast(err.response?.data?.message || 'Could not check Xero', 'error');
    } finally {
      setChecking(false);
      load();
    }
  }, [addToast, load]);

  // Show what we have at once, then bring it up to date with Xero.
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  useEffect(() => { Promise.resolve().then(() => checkXero(false, true)); }, [checkXero]);

  const toggleHelp = () => {
    setShowHelp((v) => {
      try { localStorage.setItem('rentCycleHelp', v ? 'hidden' : 'shown'); } catch { /* storage unavailable */ }
      return !v;
    });
  };

  const rows = useMemo(() => (data?.rows || []).filter((r) => !filter || r.stage === filter), [data, filter]);
  const counts = data?.counts || {};

  const approve = async (list) => {
    const total = list.reduce((s, r) => ({ fee: s.fee + r.fee, net: s.net + r.net }), { fee: 0, net: 0 });
    const ok = await confirm({
      title: list.length > 1 ? `Approve ${list.length} rent payments` : 'Approve rent',
      message: list.length > 1
        ? `ROCA fees ${money(total.fee)} · to landlords ${money(total.net)}. Each landlord's bill goes to Xero for payment.`
        : `${list[0].tenant_name} · ${list[0].flat}: ${money(list[0].received)} received. ${money(list[0].fee)} to ROCA, ${money(list[0].net)} to ${list[0].landlord_name || 'the landlord'} — the bill goes to Xero for payment.`,
      confirmText: 'Approve',
    });
    if (!ok) return;
    setBusy('approve');
    try {
      const res = await api.post('/xero/rent-cycle/approve', { payment_ids: list.flatMap((r) => r.payment_ids) });
      addToast(res.data.message, res.data.data.failed ? 'warning' : 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setBusy(null);
      load();
    }
  };

  // One row: open the Approve popup with the deductions already saved on its
  // latest payment.
  const openApprove = async (row) => {
    const paymentId = Math.max(...row.payment_ids);
    setApproveFor({ row, paymentId, items: [], saved: 0, max: null, loading: true });
    try {
      const res = await api.get(`/xero/rent-approvals/${paymentId}/deductions`, { skipInterceptorError: true });
      const d = res.data.data;
      const items = d.items.map((i) => ({ description: i.description, supplier: i.supplier || '', amount: String(i.amount) }));
      setApproveFor({ row, paymentId, items, saved: round2(d.items.reduce((t, i) => t + i.amount, 0)), max: d.max, loading: false });
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not load the deductions', 'error');
      setApproveFor(null);
    }
  };

  const setDeduction = (idx, field, value) => setApproveFor((a) => ({
    ...a, items: a.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
  }));

  const approveWithDeductions = async () => {
    const { row, paymentId, items } = approveFor;
    const clean = items.filter((i) => i.description.trim() || i.supplier.trim() || i.amount !== '');
    setBusy('approve');
    try {
      await api.put(`/xero/rent-approvals/${paymentId}/deductions`, {
        items: clean.map((i) => ({ description: i.description, supplier: i.supplier, amount: Number(i.amount) })),
      }, { skipInterceptorError: true });
      const res = await api.post('/xero/rent-cycle/approve', { payment_ids: row.payment_ids });
      addToast(res.data.message, res.data.data.failed ? 'warning' : 'success');
      setApproveFor(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setBusy(null);
      load();
    }
  };

  const makeStatements = async (list) => {
    setBusy('statement');
    let made = 0;
    for (const r of list) {
      try {
        await api.post('/approved-statements', {
          tenancy_id: r.tenancy_id, period_start: r.period.start, period_end: r.period.end, payment_ids: r.payment_ids,
        });
        made++;
      } catch (err) {
        addToast(`${r.flat}: ${err.response?.data?.message || 'statement not made'}`, 'error');
      }
    }
    if (made) addToast(`${made} statement(s) made — see View statements`, 'success');
    setBusy(null);
    load();
  };

  const saveFee = async () => {
    setBusy('fee');
    try {
      for (const id of feeFor.row.payment_ids) {
        await api.patch(`/xero/rent-approvals/${id}/split`, { fee_pct: feeFor.fee_pct, reason: feeFor.reason });
      }
      addToast(`Fee set to ${feeFor.fee_pct}% for this payment`, 'success');
      setFeeFor(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to change the fee', 'error');
    } finally {
      setBusy(null);
      load();
    }
  };

  const toApprove = (data?.rows || []).filter((r) => r.stage === 'to_approve');
  const readyForStatement = (data?.rows || []).filter((r) => r.stage === 'landlord_paid');

  const nextAction = (r) => {
    switch (r.stage) {
      case 'waiting':
        return <span className={`text-xs ${r.overdue ? 'text-status-danger font-semibold' : 'text-status-muted'}`}>{r.overdue ? `Overdue since ${ukDate(r.due_date)}` : `Due ${ukDate(r.due_date)}`}{r.invoice_number ? ' · invoice in Xero ✓' : ''}</span>;
      case 'to_approve':
        return (
          <div className="flex justify-end gap-2">
            {!r.approved_not_sent && <Button variant="ghost" size="sm" icon={Percent} onClick={() => setFeeFor({ row: r, fee_pct: String(r.fee_pct), reason: '' })} disabled={!!busy}>Change fee</Button>}
            <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => openApprove(r)} disabled={!!busy}>{r.approved_not_sent ? 'Send to Xero' : 'Approve'}</Button>
          </div>
        );
      case 'pay_landlord':
        return <span className="text-xs text-status-warning font-semibold">Pay {money(r.net)} to {r.landlord_name || 'the landlord'} from the bank</span>;
      case 'landlord_paid':
        return <Button variant="primary" size="sm" icon={FileText} onClick={() => makeStatements([r])} disabled={!!busy}>Make statement</Button>;
      case 'statement':
        return <span className="text-xs text-status-success font-semibold">{r.outside ? r.reason : `✓ ${r.statements.map((s) => s.statement_number).join(', ') || 'Done'}`}</span>;
      default:
        return (
          <div className="flex justify-end items-center gap-2">
            <span className="text-xs text-status-danger">{r.reason}</span>
            {r.retry_send && <Button variant="secondary" size="sm" onClick={() => openApprove(r)} disabled={!!busy}>Try again</Button>}
          </div>
        );
    }
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" />
          <h2 className="text-lg font-bold text-brand-primary min-w-44 text-center">{monthLabel(month)}</h2>
          <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-status-muted">Checked with Xero {agoText(data?.last_refresh)}</span>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => checkXero(true)} disabled={checking}>{checking ? 'Checking…' : 'Check now'}</Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={() => { setStatements(null); setShowStatements(true); }}>View statements</Button>
          <Button variant="ghost" size="sm" icon={HelpCircle} onClick={toggleHelp}>{showHelp ? 'Hide help' : 'How it works'}</Button>
        </div>
      </div>

      {showHelp && (
        <div className="bg-status-info-bg/40 border border-status-info/20 rounded-card p-4 text-sm text-brand-primary">
          <p className="font-bold mb-2">How the rent cycle works</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1 text-sm">
            <li><b>Waiting for rent</b> — Roca puts each month's rent into Xero, so Xero knows what to expect.</li>
            <li><b>To approve</b> — the tenant's payment arrived and was matched in Xero. Check the split (ROCA's fee and the landlord's share) and approve.</li>
            <li><b>Pay landlord</b> — the landlord's share is waiting in Xero. Pay it from the bank as usual; Xero matches it.</li>
            <li><b>Landlord paid</b> — make the landlord's statement. <b>Done</b>.</li>
          </ol>
          <p className="text-xs text-status-muted mt-2">Xero is checked when you open this page and every 30 minutes. Matching a payment in Xero (or Xero's auto-reconcile) is the only step outside Roca.</p>
        </div>
      )}

      {data && !data.xero_connected && (
        <div className="bg-status-warning/5 border border-status-warning/20 rounded-card p-4 text-sm">
          Xero is not connected. Connect it in <Link to="/settings" className="text-brand-accent font-semibold hover:underline">Settings → Xero</Link>.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${!filter ? 'bg-brand-primary text-white' : 'bg-surface-hover text-status-muted'}`}>
          All ({data?.rows?.length || 0})
        </button>
        {STAGES.filter((s) => s.id !== 'attention' || counts.attention).map((s) => (
          <button key={s.id} type="button" onClick={() => setFilter(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${filter === s.id ? 'bg-brand-primary text-white' : s.tone}`}>
            {s.label} ({counts[s.id] || 0})
          </button>
        ))}
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium overflow-x-auto">
        {data === null ? (
          <p className="text-sm text-status-muted py-10 text-center">Loading…</p>
        ) : !rows.length ? (
          <p className="text-sm text-status-muted py-10 text-center">No rent {filter ? 'at this stage' : 'due this month for managed flats'}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-status-muted border-b border-card-border">
                <th className="p-3">Flat</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Landlord</th>
                <th className="p-3 text-right">Rent</th>
                <th className="p-3 text-right">Received</th>
                <th className="p-3 text-right">ROCA fee</th>
                <th className="p-3 text-right">To landlord</th>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">Next</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-card-border/60 last:border-0 align-middle">
                  <td className="p-3 font-semibold text-brand-primary whitespace-nowrap">{r.flat}</td>
                  <td className="p-3">{r.tenant_id ? <Link to={`/tenants/${r.tenant_id}`} className="hover:underline">{r.tenant_name}</Link> : r.tenant_name || '—'}</td>
                  <td className="p-3">{r.landlord_name || '—'}</td>
                  <td className="p-3 text-right whitespace-nowrap">{money(r.rent_due)}<div className="text-xs text-status-muted">{ukDate(r.due_date)}</div></td>
                  <td className="p-3 text-right">{r.received ? money(r.received) : '—'}</td>
                  <td className="p-3 text-right">{r.received ? <>{money(r.fee)}<div className="text-xs text-status-muted">{r.fee_pct}%</div></> : '—'}</td>
                  <td className="p-3 text-right font-semibold">
                    {r.received ? money(r.net) : '—'}
                    {r.deductions > 0 && <div className="text-xs font-normal text-status-muted whitespace-nowrap">after {money(r.deductions)} deductions</div>}
                  </td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${stageInfo(r.stage).tone}`}>{stageInfo(r.stage).label}</span>{r.split_note && <div className="text-xs text-status-warning mt-1">Note: {r.split_note}</div>}</td>
                  <td className="p-3 text-right">{nextAction(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(toApprove.length > 1 || readyForStatement.length > 1 || data?.landlord_totals?.length > 0) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {data?.landlord_totals?.length > 0 ? (
            <div className="card-bg border border-card-border rounded-card p-4 text-sm">
              <p className="font-bold text-brand-primary mb-2">To pay landlords from the bank</p>
              {data.landlord_totals.map((t) => (
                <div key={t.landlord} className="flex justify-between gap-8"><span>{t.landlord}</span><span className="font-semibold">{money(t.amount)}</span></div>
              ))}
            </div>
          ) : <span />}
          <div className="flex gap-2">
            {toApprove.length > 1 && <Button variant="primary" icon={CheckCircle2} onClick={() => approve(toApprove)} disabled={!!busy}>Approve all ({toApprove.length})</Button>}
            {readyForStatement.length > 1 && <Button variant="secondary" icon={FileText} onClick={() => makeStatements(readyForStatement)} disabled={!!busy}>Make all statements ({readyForStatement.length})</Button>}
          </div>
        </div>
      )}

      {showStatements && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl border border-card-border overflow-hidden my-8">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
              <FileText size={18} />
              <span>Statements — {allMonths ? 'all months' : monthLabel(month)}</span>
              <button type="button" onClick={() => setShowStatements(false)} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-status-muted flex items-center gap-1.5">Statements made from approved rent <InfoTip text='Made with "Make statement" on this page. Generate Statement on the Statements page is separate.' /></p>
                <Button variant="ghost" size="sm" onClick={() => setAllMonths((v) => !v)}>{allMonths ? 'Show this month' : 'Show all months'}</Button>
              </div>
              <ApprovedStatementsTable
                rows={statements}
                onChanged={() => { loadStatements(); load(); }}
                emptyText={allMonths ? 'No statements yet.' : 'No statements for this month yet — rows at "Landlord paid" have a Make statement button.'}
              />
            </div>
          </div>
        </div>
      )}

      {approveFor && (() => {
        const { row, items, saved, max, loading } = approveFor;
        const total = round2(items.reduce((t, i) => t + (Number(i.amount) || 0), 0));
        const toLandlord = round2(row.net + saved - total);
        const tooMuch = max !== null && total > max;
        const incomplete = items.some((i) => (i.description.trim() || i.supplier.trim() || i.amount !== '') && (!i.description.trim() || !(Number(i.amount) > 0)));
        return (
          <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-card-border overflow-hidden my-8">
              <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
                <CheckCircle2 size={18} />
                <span>{row.approved_not_sent || row.retry_send ? 'Send to Xero' : 'Approve rent'} — {row.flat} · {row.tenant_name || 'Tenant'}</span>
                <button type="button" onClick={() => setApproveFor(null)} disabled={busy === 'approve'} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              {loading ? (
                <p className="text-sm text-status-muted py-10 text-center">Loading…</p>
              ) : (
                <div className="p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <span className="text-status-muted">Rent received</span><span className="text-right font-semibold">{money(row.received)}</span>
                    <span className="text-status-muted">ROCA fee ({row.fee_pct}%)</span><span className="text-right font-semibold">−{money(row.fee)}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-brand-primary flex items-center gap-1.5">Deductions <InfoTip text="Costs ROCA paid for this flat (cleaning, repairs). They come out of the landlord's share." /></p>
                    </div>
                    {items.length === 0 && <p className="text-xs text-status-muted">No deductions.</p>}
                    {items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_110px_auto] gap-2 items-center">
                        <input aria-label="Description" placeholder="Description, e.g. End of tenancy clean" value={it.description} onChange={(e) => setDeduction(idx, 'description', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-accent" maxLength={255} />
                        <input aria-label="Supplier" placeholder="Supplier (optional)" value={it.supplier} onChange={(e) => setDeduction(idx, 'supplier', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-accent" maxLength={255} />
                        <input aria-label="Amount" type="number" min="0" step="0.01" placeholder="£" value={it.amount} onChange={(e) => setDeduction(idx, 'amount', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:border-brand-accent" />
                        <button type="button" onClick={() => setApproveFor((a) => ({ ...a, items: a.items.filter((_, i) => i !== idx) }))}
                          className="p-2 text-status-muted hover:text-status-danger cursor-pointer" aria-label="Remove deduction"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <div>
                      <Button variant="ghost" size="sm" icon={Plus} onClick={() => setApproveFor((a) => ({ ...a, items: [...a.items, emptyDeduction()] }))}>Add deduction</Button>
                    </div>
                  </div>

                  <div className="border-t border-card-border pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {total > 0 && <><span className="text-status-muted">Deductions</span><span className="text-right font-semibold">−{money(total)}</span></>}
                    <span className="font-bold text-brand-primary">To landlord ({row.landlord_name || 'landlord'})</span>
                    <span className={`text-right font-bold ${tooMuch ? 'text-status-danger' : 'text-brand-primary'}`}>{money(toLandlord)}</span>
                  </div>
                  {tooMuch && <p className="text-xs text-status-danger">Deductions ({money(total)}) can't be more than the landlord's share ({money(max)}).</p>}
                  {incomplete && !tooMuch && <p className="text-xs text-status-warning">Each deduction needs a description and an amount.</p>}
                  <p className="text-xs text-status-muted">Approving sends a {money(toLandlord)} bill to Xero{total > 0 ? ' (deductions as separate lines)' : ''}.</p>

                  <div className="flex gap-3 justify-end pt-2 border-t border-card-border">
                    <Button variant="ghost" onClick={() => setApproveFor(null)} disabled={busy === 'approve'}>Cancel</Button>
                    <Button variant="primary" icon={CheckCircle2} onClick={approveWithDeductions} disabled={busy === 'approve' || tooMuch || incomplete}>
                      {busy === 'approve' ? 'Sending…' : 'Approve & send to Xero'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {feeFor && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-card-border flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-primary">Change the fee — {feeFor.row.flat}</h3>
              <button onClick={() => setFeeFor(null)} className="text-gray-400 hover:text-brand-primary cursor-pointer" aria-label="Close"><X size={20} /></button>
            </div>
            <Input label="Management fee (%)" id="cycleFeePct" type="number" min="0" max="30" step="0.01" value={feeFor.fee_pct} onChange={(e) => setFeeFor((s) => ({ ...s, fee_pct: e.target.value }))}
              hint="Only this payment changes. The flat's own fee stays." />
            <Input label="Reason" id="cycleFeeReason" placeholder="e.g. fee waived this month" value={feeFor.reason} onChange={(e) => setFeeFor((s) => ({ ...s, reason: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setFeeFor(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveFee} disabled={busy === 'fee'}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
