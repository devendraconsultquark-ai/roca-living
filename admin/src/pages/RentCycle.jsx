import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, Percent, FileText, X, HelpCircle, Plus, Trash2, Mail, Search } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { AllStatementsTable } from '../components/UI/AllStatementsTable';
import { StatementEmailModal } from '../components/UI/StatementEmailModal';
import api from '../utilities/api';
import { InfoTip } from '../components/UI/InfoTip';
import { Dropdown } from '../components/UI/Dropdown';
import { DatePicker } from '../components/UI/DatePicker';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
const shiftMonth = (ym, by) => {
  const d = new Date(`${ym}-01T00:00:00`);
  d.setMonth(d.getMonth() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };
const shortMonth = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-GB', { month: 'short' });
// The period shown: one month (arrows), the last 3 / 6 months ending with the
// month shown (arrows move the window), or a custom From–To range (≤ 12 months).
const PERIODS = [
  { value: 'month', label: 'This Month' },
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
  { value: 'custom', label: 'Custom Range' },
];
const periodOf = (period, month, custom) => {
  if (period === 'custom') {
    return custom.from && custom.to
      ? { from: custom.from, to: custom.to, label: `${ukDate(custom.from)} – ${ukDate(custom.to)}`, arrows: false }
      : { label: null, arrows: false }; // asks for From and To first
  }
  if (period === '3' || period === '6') {
    const start = shiftMonth(month, -(Number(period) - 1));
    const sameYear = start.slice(0, 4) === month.slice(0, 4);
    return {
      from: `${start}-01`, to: lastDay(month), arrows: true,
      label: `${sameYear ? shortMonth(start) : monthLabel(start)} – ${shortMonth(month)} ${month.slice(0, 4)}`,
    };
  }
  return { month, label: monthLabel(month), arrows: true };
};
const PERIOD_KEY = 'rentCyclePeriod';
// View Statements popup filters.
const STATEMENT_PERIODS = [
  { value: 'cycle', label: 'Same As Rent Cycle' },
  { value: 'all', label: 'All Months' },
  { value: 'custom', label: 'Custom Range' },
];
const STATEMENT_STATUSES = [
  { value: '', label: 'Sent And Not Sent' },
  { value: 'sent', label: 'Sent' },
  { value: 'unsent', label: 'Not Sent' },
];
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
// Part of the rent arrived: the month waits for the rest (shown as Part Paid).
const isPartPaid = (r) => r.stage === 'waiting' && !!r.part_paid;
const PART_PAID = { label: 'Part Paid', tone: 'bg-status-warning/10 text-status-warning' };
// The payments Approve settles: the month's parts not on a landlord bill yet
// (all of them together), else all (Try again on a bill already in Xero).
const settleIds = (r) => (r.open_payment_ids?.length ? r.open_payment_ids : r.payment_ids);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const emptyDeduction = () => ({ description: '', supplier: '', amount: '' });

// Accounting → Rent Cycle: each managed flat's rent for the month, from "waiting
// for rent" to "done", with the one thing to do next on each row. Xero is
// checked automatically when the page opens (and every 30 minutes).
export const RentCycle = () => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(thisMonth());
  const [period, setPeriod] = useState(() => {
    try { const v = localStorage.getItem(PERIOD_KEY); return PERIODS.some((x) => x.value === v) && v !== 'custom' ? v : 'month'; } catch { return 'month'; }
  });
  // Custom range: what is typed, and what is shown (after Show).
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' });
  const [custom, setCustom] = useState({ from: '', to: '' });
  const view = useMemo(() => periodOf(period, month, custom), [period, month, custom]);
  const viewParams = useMemo(() => (view.month ? { month: view.month } : view.from ? { from: view.from, to: view.to } : null), [view]);
  const choosePeriod = (v) => {
    setPeriod(v);
    try { localStorage.setItem(PERIOD_KEY, v); } catch { /* private mode */ }
  };
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(null);
  const [feeFor, setFeeFor] = useState(null); // { row, fee_pct, reason }
  // Email popup for a Done row's statement (stable close: the page re-renders on a timer).
  const [emailFor, setEmailFor] = useState(null);
  const closeEmail = useCallback(() => setEmailFor(null), []);
  // Approve popup: deductions (cleaning, repairs…) before the landlord bill goes to Xero
  const [approveFor, setApproveFor] = useState(null); // { row, paymentId, items, saved, max, loading }
  // Statements from approved rent, shown in the View statements popup (this month, or all)
  const [showStatements, setShowStatements] = useState(false);
  const [statements, setStatements] = useState(null);
  // Popup filters: which statements (period), sent or not, and a search.
  const [stmtPeriod, setStmtPeriod] = useState('cycle');
  const [stmtDraft, setStmtDraft] = useState({ from: '', to: '' });
  const [stmtRange, setStmtRange] = useState({ from: '', to: '' });
  const [stmtStatus, setStmtStatus] = useState('');
  const [stmtSearch, setStmtSearch] = useState('');
  const stmtParams = useMemo(() => {
    if (stmtPeriod === 'all') return {};
    if (stmtPeriod === 'custom') return stmtRange.from && stmtRange.to ? { from: stmtRange.from, to: stmtRange.to } : null;
    return viewParams;
  }, [stmtPeriod, stmtRange, viewParams]);
  const stmtLabel = stmtPeriod === 'all' ? 'All Months'
    : stmtPeriod === 'custom' ? (stmtRange.from && stmtRange.to ? `${ukDate(stmtRange.from)} – ${ukDate(stmtRange.to)}` : 'Custom Range') : view.label;
  const shownStatements = useMemo(() => {
    if (!statements) return statements;
    const q = stmtSearch.trim().toLowerCase();
    // "Sent" = issued to the landlord (sent or paid); "Not sent" = drafts.
    return statements.filter((st) => (!stmtStatus || (stmtStatus === 'sent' ? st.status !== 'draft' : st.status === 'draft'))
      && (!q || [st.statement_number, st.landlord_name, st.flat, st.tenant_name].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [statements, stmtStatus, stmtSearch]);
  const [showHelp, setShowHelp] = useState(() => {
    try { return localStorage.getItem('rentCycleHelp') !== 'hidden'; } catch { return true; }
  });

  const load = useCallback(async () => {
    try {
      if (!viewParams) { // custom range not chosen yet: show nothing until Show
        setData((d) => ({ ...(d || {}), rows: [], counts: {}, landlord_totals: [], contractor_totals: [], fees_to_move: [] }));
        return;
      }
      const res = await api.get('/xero/rent-cycle', { params: viewParams, skipInterceptorError: true });
      setData(res.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load the rent cycle', 'error');
      setData({ rows: [], counts: {}, landlord_totals: [] });
    }
  }, [viewParams, addToast]);

  const loadStatements = useCallback(async () => {
    try {
      if (!stmtParams) { setStatements([]); return; } // custom range not chosen yet
      // Every statement for the period (Rent Cycle, Roca Living, Historic) — one list everywhere.
      const res = await api.get('/all-statements', { params: stmtParams, skipInterceptorError: true });
      setStatements(res.data.data?.rows || []);
    } catch {
      setStatements([]);
    }
  }, [stmtParams]);

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
      const res = await api.post('/xero/rent-cycle/approve', { payment_ids: list.flatMap(settleIds) });
      addToast(res.data.message, res.data.data.failed ? 'warning' : 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setBusy(null);
      load();
    }
  };

  // One row: open the Approve popup with the deductions already saved on its
  // latest payment (a month paid in parts is approved as one).
  const openApprove = async (row) => {
    const paymentId = row.lead_payment_id || Math.max(...row.payment_ids);
    setApproveFor({ row, paymentId, items: [], saved: 0, max: null, loading: true });
    try {
      const res = await api.get(`/xero/rent-approvals/${paymentId}/deductions`, { skipInterceptorError: true });
      const d = res.data.data;
      // Repairs from Maintenance come with the payment and can't be edited here.
      const items = d.items.map((i) => ({
        description: i.description, supplier: i.supplier || '', amount: String(i.amount),
        repair: i.from_maintenance, ticketId: i.ticket_id, contractor: i.contractor || null,
      }));
      setApproveFor({
        row, paymentId, items, saved: round2(d.items.reduce((t, i) => t + i.amount, 0)), max: d.max, waiting: d.repairs_waiting || [],
        amount: d.payment.amount, fee: d.payment.fee_amount, parts: d.payment.parts || [],
        feeReady: d.fee_transfer_ready, editable: d.editable, loading: false,
      });
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not load the deductions', 'error');
      setApproveFor(null);
    }
  };

  const setDeduction = (idx, field, value) => setApproveFor((a) => ({
    ...a, items: a.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
  }));

  const approveWithDeductions = async () => {
    const { row, paymentId, items, editable } = approveFor;
    const clean = items.filter((i) => !i.repair && (i.description.trim() || i.supplier.trim() || i.amount !== ''));
    setBusy('approve');
    try {
      if (editable) {
        await api.put(`/xero/rent-approvals/${paymentId}/deductions`, {
          items: clean.map((i) => ({ description: i.description, supplier: i.supplier, amount: Number(i.amount) })),
        }, { skipInterceptorError: true });
      }
      const res = await api.post('/xero/rent-cycle/approve', { payment_ids: settleIds(row) });
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
      for (const id of settleIds(feeFor.row)) {
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
        if (isPartPaid(r)) {
          return (
            <div className="flex justify-end items-center gap-2">
              <span className={`text-xs ${r.overdue ? 'text-status-danger font-semibold' : 'text-status-muted'}`}>
                {r.overdue ? `${money(r.part_paid.owed)} still owed · overdue since ${ukDate(r.due_date)}` : `Waiting for ${money(r.part_paid.owed)}`}
              </span>
              <Button variant="secondary" size="sm" onClick={() => openApprove(r)} disabled={!!busy}>Pay Landlord What&apos;s Received</Button>
              <InfoTip text="Only needed if the landlord shouldn't wait for the rest. Otherwise the month moves to To Approve on its own once the rent is complete." />
            </div>
          );
        }
        return <span className={`text-xs ${r.overdue ? 'text-status-danger font-semibold' : 'text-status-muted'}`}>{r.overdue ? `Overdue since ${ukDate(r.due_date)}` : `Due ${ukDate(r.due_date)}`}{r.invoice_number ? ' · invoice in Xero ✓' : ''}</span>;
      case 'to_approve':
        return (
          <div className="flex justify-end gap-2">
            {!r.approved_not_sent && <Button variant="ghost" size="sm" icon={Percent} onClick={() => setFeeFor({ row: r, fee_pct: String(r.fee_pct), reason: '' })} disabled={!!busy}>Change fee</Button>}
            <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => openApprove(r)} disabled={!!busy}>{r.approved_not_sent ? 'Send to Xero' : 'Approve'}</Button>
          </div>
        );
      case 'pay_landlord':
        return <span className="text-xs text-status-warning font-semibold">Pay {money(r.landlord_to_pay || r.net)} to {r.landlord_name || 'the landlord'} from the bank</span>;
      case 'landlord_paid':
        return <Button variant="primary" size="sm" icon={FileText} onClick={() => makeStatements([r])} disabled={!!busy}>Make statement</Button>;
      case 'statement': {
        if (r.outside || !r.statements.length) return <span className="text-xs text-status-success font-semibold">{r.outside ? r.reason : '✓ Done'}</span>;
        // The statement goes to the landlord by email (same popup as the Statements page).
        const unsent = r.statements.find((st) => !st.sent_at);
        return (
          <div className="flex justify-end items-center gap-2">
            <span className="text-xs text-status-success font-semibold">
              ✓ {r.statements.map((st) => st.statement_number).join(', ')}{unsent ? '' : ' · sent'}
            </span>
            {unsent && <Button variant="primary" size="sm" icon={Mail} onClick={() => setEmailFor(unsent.id)} disabled={!!busy}>Send</Button>}
          </div>
        );
      }
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
        <div className="flex flex-wrap items-center gap-2">
          {view.arrows && <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" />}
          <h2 className="text-lg font-bold text-brand-primary min-w-44 text-center">{view.label || 'Choose a Range'}</h2>
          {view.arrows && <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month" />}
          <Dropdown id="rentCyclePeriod" options={PERIODS} value={period} onChange={choosePeriod} size="sm" className="w-44" />
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker id="rentCycleFrom" size="sm" placeholder="From" value={customDraft.from} max={customDraft.to || undefined}
                onChange={(v) => setCustomDraft((c) => ({ ...c, from: v }))} />
              <DatePicker id="rentCycleTo" size="sm" placeholder="To" value={customDraft.to} min={customDraft.from || undefined}
                onChange={(v) => setCustomDraft((c) => ({ ...c, to: v }))} />
              <Button variant="primary" size="sm" disabled={!customDraft.from || !customDraft.to} onClick={() => setCustom(customDraft)}>Show</Button>
              <InfoTip text="Up to 12 months." />
            </div>
          )}
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
            <li><b>Waiting for rent</b> — Roca puts each month's rent into Xero, so Xero knows what to expect. Rent paid in parts shows as <b>Part Paid</b> and is approved once, when complete.</li>
            <li><b>To approve</b> — the tenant's payment arrived and was matched in Xero. Check the split (ROCA's fee and the landlord's share) and approve.</li>
            <li><b>Pay landlord</b> — the landlord's share (and any contractor) is waiting in Xero, and ROCA's fee is recorded as a transfer. Do these in your bank (see To Do in the Bank); Xero matches them.</li>
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
        ) : !viewParams || !rows.length ? (
          <p className="text-sm text-status-muted py-10 text-center">{!viewParams ? 'Choose From and To, then Show.' : `No rent ${filter ? 'at this stage' : `due ${view.month ? 'this month' : 'in this period'} for managed flats`}.`}</p>
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
                <th className="p-3 text-right">Maintenance</th>
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
                  <td className="p-3 text-right">
                    {r.received ? money(r.received) : '—'}
                    {r.part_paid && <div className="text-xs text-status-warning whitespace-nowrap">of {money(r.part_paid.due)} · {money(r.part_paid.owed)} owed</div>}
                  </td>
                  <td className="p-3 text-right">
                    {r.received ? <>{money(r.fee)}<div className="text-xs text-status-muted">{r.fee_pct}%</div></> : '—'}
                    {r.fee_transfer?.status === 'recorded' && (
                      <div className="text-xs text-status-warning inline-flex items-center gap-1 whitespace-nowrap">
                        to move <InfoTip text="Recorded in Xero. Move it in your bank (rent account → fee account); it shows moved once Xero matches both bank lines." />
                      </div>
                    )}
                    {r.fee_transfer?.status === 'moved' && <div className="text-xs text-status-success whitespace-nowrap">moved ✓</div>}
                    {r.fee_transfer?.status === 'skipped' && (
                      <div className="text-xs text-status-muted inline-flex items-center gap-1 whitespace-nowrap">
                        not recorded <InfoTip text={r.fee_transfer.error || 'Choose the bank accounts in Settings → Xero'} />
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {r.deductions > 0 ? (
                      <>
                        <span className="font-semibold text-status-danger">−{money(r.deductions)}</span>
                        {(r.contractor_bills || []).map((b) => (
                          <div key={b.ticket_id} className="text-xs text-status-muted whitespace-nowrap">
                            {b.contractor || 'No contractor'} · #{b.ticket_id}
                            {b.status === 'paid' && <span className="text-status-success"> · paid ✓</span>}
                            {b.status === 'posted' && <span className="text-status-warning"> · to pay</span>}
                            {b.status === 'no_contractor' && <span className="text-status-warning"> · no bill</span>}
                          </div>
                        ))}
                      </>
                    ) : r.received ? <span className="text-status-muted">{money(0)}</span> : '—'}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {r.received ? money(r.net) : '—'}
                    {/* Settled in two goes (part paid): say how much is paid and how much is still to pay. */}
                    {r.landlord_paid_amount > 0 && (
                      <div className="text-xs font-normal text-status-success whitespace-nowrap">{r.landlord_paid_amount === r.net ? 'paid ✓' : `${money(r.landlord_paid_amount)} paid ✓`}</div>
                    )}
                    {r.landlord_to_pay > 0 && (
                      <div className="text-xs font-normal text-status-warning whitespace-nowrap">{r.landlord_to_pay === r.net ? 'to pay' : `${money(r.landlord_to_pay)} to pay`}</div>
                    )}
                    {r.repairs_waiting?.length > 0 && (
                      <div className="text-xs font-normal text-status-warning whitespace-nowrap inline-flex items-center gap-1">
                        Repair waiting <InfoTip text={r.repairs_waiting.map((w) => `${w.title} (ticket #${w.id}, ${money(w.cost)})`).join('; ') + " — more than what is left of the landlord's share, so it waits for a later payment."} />
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {(() => { const st = isPartPaid(r) ? PART_PAID : stageInfo(r.stage); return <span className={`px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${st.tone}`}>{st.label}</span>; })()}
                    {r.split_note && <div className="text-xs text-status-warning mt-1">Note: {r.split_note}</div>}
                  </td>
                  <td className="p-3 text-right">{nextAction(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(toApprove.length > 1 || readyForStatement.length > 1 || data?.landlord_totals?.length > 0 || data?.contractor_totals?.length > 0 || data?.fees_to_move?.length > 0) && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          {data?.landlord_totals?.length > 0 || data?.contractor_totals?.length > 0 || data?.fees_to_move?.length > 0 ? (
            <div className="card-bg border border-card-border rounded-card p-4 text-sm flex flex-col gap-3 min-w-80">
              <p className="font-bold text-brand-primary flex items-center gap-1.5">
                To Do in the Bank
                <InfoTip text="Xero has these recorded. Make them in your online banking; each one clears here once Xero matches it to the bank." />
              </p>
              {data.landlord_totals?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-status-muted mb-1">Pay Landlords</p>
                  {data.landlord_totals.map((t) => (
                    <div key={t.landlord} className="flex justify-between gap-8"><span>{t.landlord}</span><span className="font-semibold">{money(t.amount)}</span></div>
                  ))}
                </div>
              )}
              {data.contractor_totals?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-status-muted mb-1">Pay Contractors</p>
                  {data.contractor_totals.map((t) => (
                    <div key={t.contractor} className="flex justify-between gap-8"><span>{t.contractor}</span><span className="font-semibold">{money(t.amount)}</span></div>
                  ))}
                </div>
              )}
              {data.fees_to_move?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-status-muted mb-1">Move ROCA&apos;s Fee (Rent Account → Fee Account)</p>
                  {data.fees_to_move.map((f) => (
                    <div key={f.id} className="flex justify-between gap-8">
                      <span>{f.flat} <span className="text-xs text-status-muted">{f.reference}</span></span>
                      <span className="font-semibold">{money(f.amount)}</span>
                    </div>
                  ))}
                  {data.fees_to_move.length > 1 && (
                    <div className="flex justify-between gap-8 border-t border-card-border mt-1 pt-1"><span>Total</span><span className="font-bold">{money(data.fees_to_move.reduce((t, f) => t + f.amount, 0))}</span></div>
                  )}
                </div>
              )}
            </div>
          ) : <span />}
          <div className="flex gap-2">
            {toApprove.length > 1 && <Button variant="primary" icon={CheckCircle2} onClick={() => approve(toApprove)} disabled={!!busy}>Approve all ({toApprove.length})</Button>}
            {readyForStatement.length > 1 && <Button variant="secondary" icon={FileText} onClick={() => makeStatements(readyForStatement)} disabled={!!busy}>Make all statements ({readyForStatement.length})</Button>}
          </div>
        </div>
      )}

      {showStatements && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm z-50 p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full h-full shadow-xl border border-card-border overflow-hidden flex flex-col">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none shrink-0">
              <FileText size={18} />
              <span>Statements — {stmtLabel || 'Choose a Range'}</span>
              <button type="button" onClick={() => setShowStatements(false)} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Dropdown id="stmtPeriod" options={STATEMENT_PERIODS} value={stmtPeriod} onChange={setStmtPeriod} size="sm" className="w-48" />
                {stmtPeriod === 'custom' && (
                  <>
                    <DatePicker id="stmtFrom" size="sm" placeholder="From" value={stmtDraft.from} max={stmtDraft.to || undefined} onChange={(v) => setStmtDraft((c) => ({ ...c, from: v }))} />
                    <DatePicker id="stmtTo" size="sm" placeholder="To" value={stmtDraft.to} min={stmtDraft.from || undefined} onChange={(v) => setStmtDraft((c) => ({ ...c, to: v }))} />
                    <Button variant="primary" size="sm" disabled={!stmtDraft.from || !stmtDraft.to} onClick={() => setStmtRange(stmtDraft)}>Show</Button>
                  </>
                )}
                <Dropdown id="stmtStatus" options={STATEMENT_STATUSES} value={stmtStatus} onChange={setStmtStatus} size="sm" className="w-48" />
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-status-muted" />
                  <input type="search" aria-label="Search statements" placeholder="Search landlord, flat, tenant…" value={stmtSearch} onChange={(e) => setStmtSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 w-72 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent" />
                </div>
                <p className="ml-auto text-xs text-status-muted flex items-center gap-1.5">
                  {shownStatements ? `${shownStatements.length} statement(s)` : ''} <InfoTip text='Every statement for these months: Rent Cycle (Make Statement), Roca Living (Generate Statement) and Historic — the same list as the Statements page. Period = the statement period start.' />
                </p>
              </div>
              <AllStatementsTable
                rows={shownStatements}
                onChanged={() => { loadStatements(); load(); }}
                emptyText={!stmtParams ? 'Choose From and To, then Show.' : stmtSearch || stmtStatus ? 'No statements match these filters.' : 'No statements in this period yet — rows at "Landlord paid" have a Make Statement button.'}
              />
            </div>
          </div>
        </div>
      )}

      {approveFor && (() => {
        const { row, items, max, loading, waiting = [], feeReady, editable = true, parts = [] } = approveFor;
        const amount = approveFor.amount ?? row.received;
        const fee = approveFor.fee ?? row.fee;
        const partial = isPartPaid(row);
        const total = round2(items.reduce((t, i) => t + (Number(i.amount) || 0), 0));
        const toLandlord = max !== null ? round2(max - total) : round2(row.net - total);
        const tooMuch = max !== null && total > max;
            const incomplete = items.some((i) => !i.repair && (i.description.trim() || i.supplier.trim() || i.amount !== '') && (!i.description.trim() || !(Number(i.amount) > 0)));
        return (
          <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-card-border overflow-hidden my-8">
              <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
                <CheckCircle2 size={18} />
                <span>{partial ? "Pay Landlord What's Received" : row.approved_not_sent || row.retry_send ? 'Send to Xero' : 'Approve rent'} — {row.flat} · {row.tenant_name || 'Tenant'}</span>
                <button type="button" onClick={() => setApproveFor(null)} disabled={busy === 'approve'} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              {loading ? (
                <p className="text-sm text-status-muted py-10 text-center">Loading…</p>
              ) : (
                <div className="p-6 flex flex-col gap-4">
                  {partial && (
                    <p className="text-xs text-status-warning bg-status-warning/10 rounded-lg px-3 py-2">
                      Only {money(row.part_paid.received)} of {money(row.part_paid.due)} has arrived. The {money(row.part_paid.owed)} still owed comes back to To Approve when it&apos;s paid.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <span className="text-status-muted">Rent received</span><span className="text-right font-semibold">{money(amount)}</span>
                    {parts.map((pt) => (
                      <span key={pt.id} className="col-span-2 flex justify-between text-xs text-status-muted pl-3">
                        <span>Paid {ukDate(pt.received_at)}</span><span>{money(pt.amount)}</span>
                      </span>
                    ))}
                    <span className="text-status-muted">ROCA fee ({row.fee_pct}%)</span><span className="text-right font-semibold">−{money(fee)}</span>
                    <span className={`col-span-2 text-xs ${feeReady ? 'text-status-muted' : 'text-status-warning'}`}>
                      {feeReady
                        ? '→ Recorded in Xero as a transfer to the ROCA fee account. Then move the money in your bank.'
                        : <>→ Not moved: choose the bank accounts in <Link to="/settings" className="font-semibold underline">Settings → Xero</Link></>}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-brand-primary flex items-center gap-1.5">Deductions <InfoTip text="Costs ROCA paid for this flat (cleaning, repairs). They come out of the landlord's share." /></p>
                    </div>
                    {items.length === 0 && <p className="text-xs text-status-muted">No deductions.</p>}
                    {items.map((it, idx) => (it.repair ? (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_110px_auto] gap-2 items-center text-sm bg-surface-light border border-card-border rounded-lg px-3 py-2">
                        <span className="font-semibold text-brand-primary min-w-0 break-words">{it.description}</span>
                        <span className="text-status-muted min-w-0 break-words">{it.supplier || '—'}</span>
                        <span className="text-right font-semibold">{money(Number(it.amount))}</span>
                        <span className="inline-flex items-center gap-1 text-2xs font-bold text-brand-accent whitespace-nowrap">
                          From Maintenance <InfoTip text="Added automatically when the repair was completed. Change its cost on the maintenance ticket." />
                        </span>
                        <span className={`col-span-4 text-xs ${it.contractor ? 'text-status-muted' : 'text-status-warning'}`}>
                          {it.contractor
                            ? `→ Bill to ${it.contractor} in Xero on approval`
                            : `→ No contractor on ticket #${it.ticketId}: no bill (pay the supplier yourself)`}
                        </span>
                      </div>
                    ) : (
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
                    )))}
                    {waiting.map((w) => (
                      <p key={w.id} className="text-xs text-status-warning">
                        Repair “{w.title}” (ticket #{w.id}, {money(w.cost)}) is more than what is left of the landlord&apos;s share, so it waits for a later payment.
                      </p>
                    ))}
                    {editable && (
                      <div>
                        <Button variant="ghost" size="sm" icon={Plus} onClick={() => setApproveFor((a) => ({ ...a, items: [...a.items, emptyDeduction()] }))}>Add deduction</Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-card-border pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    {total > 0 && <><span className="text-status-muted">Deductions</span><span className="text-right font-semibold">−{money(total)}</span></>}
                    <span className="font-bold text-brand-primary">To landlord ({row.landlord_name || 'landlord'})</span>
                    <span className={`text-right font-bold ${tooMuch ? 'text-status-danger' : 'text-brand-primary'}`}>{money(toLandlord)}</span>
                  </div>
                  {tooMuch && <p className="text-xs text-status-danger">Deductions ({money(total)}) can't be more than the landlord's share ({money(max)}).</p>}
                  {incomplete && !tooMuch && <p className="text-xs text-status-warning">Each deduction needs a description and an amount.</p>}
                  <p className="text-xs text-status-muted">
                    Approving sends to Xero: a {money(toLandlord)} bill to {row.landlord_name || 'the landlord'}{total > 0 ? ' (deductions as separate lines)' : ''}
                    {items.some((i) => i.repair && i.contractor) ? ', a bill to each contractor' : ''}
                    {feeReady && fee > 0 ? `, and ${money(fee)} recorded as moving to ROCA's account` : ''}. Xero only records these: you pay and move the money in your bank (see To Do in the Bank).
                  </p>

                  <div className="flex gap-3 justify-end pt-2 border-t border-card-border">
                    <Button variant="ghost" onClick={() => setApproveFor(null)} disabled={busy === 'approve'}>Cancel</Button>
                    <Button variant="primary" icon={CheckCircle2} onClick={approveWithDeductions} disabled={busy === 'approve' || tooMuch || incomplete}>
                      {busy === 'approve' ? 'Sending…' : partial ? 'Pay What Has Arrived' : 'Approve & send to Xero'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {emailFor && <StatementEmailModal statementId={emailFor} basePath="/approved-statements" onClose={closeEmail} onSent={load} />}

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
