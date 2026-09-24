import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, Link2, EyeOff, Undo2, ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { Skeleton } from './Skeleton';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (s) => (s ? s.split('-').reverse().join('/') : '—');
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';

const STATUS_TABS = [
  { key: 'unreconciled', label: 'To reconcile' },
  { key: 'reconciled', label: 'Reconciled' },
  { key: 'ignored', label: 'Ignored' },
];
const DIRECTIONS = [
  { key: '', label: 'All' },
  { key: 'in', label: 'Money in' },
  { key: 'out', label: 'Money out' },
];
const AS_LABEL = { tenant_rent: 'Tenant rent', landlord_payout: 'Landlord payout', property_expense: 'Property expense' };

// Accounting → Bank Transactions: money in/out imported from Xero, reconciled
// to tenant rent, landlord payouts or property expenses (rocaem-style).
export const BankTransactionsTab = () => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('unreconciled');
  const [direction, setDirection] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [reconcileRow, setReconcileRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/xero/transactions', { params: { status, direction: direction || undefined } });
        if (!cancelled) setData(res.data.data);
      } catch (err) {
        if (!cancelled) addToast(err.response?.data?.message || 'Failed to load bank transactions', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [status, direction, reloadKey, addToast]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const switchStatus = (s) => { setLoading(true); setStatus(s); };
  const switchDirection = (d) => { setLoading(true); setDirection(d); };

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/xero/sync', null, { skipInterceptorError: true });
      addToast(res.data.message, 'success');
      reload();
    } catch (err) {
      addToast(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const act = async (row, url, body, success) => {
    setBusyId(row.id);
    try {
      await api.post(url, body || {});
      addToast(success, 'success');
      reload();
    } catch (err) {
      addToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmSuggestion = (row) => {
    if (row.suggestion.as === 'tenant_rent') {
      act(row, `/xero/transactions/${row.id}/reconcile`, { as: 'tenant_rent', tenancy_id: row.suggestion.tenancy_id }, 'Recorded as rent');
    } else {
      setReconcileRow(row); // payouts need the statement(s) chosen
    }
  };

  const undo = async (row) => {
    const ok = await confirm({
      title: 'Undo reconciliation?',
      message: 'This moves the transaction back to "To reconcile" and removes what it created (rent payment, expense, or paid status on statements).',
      confirmText: 'Undo',
      variant: 'danger',
    });
    if (ok) act(row, `/xero/transactions/${row.id}/undo`, null, 'Moved back to To reconcile');
  };

  const rows = data?.rows || [];
  const counts = data?.counts || {};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchStatus(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                status === t.key ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-brand-primary hover:bg-surface-hover'
              }`}
            >
              {t.label} ({counts[t.key] || 0})
            </button>
          ))}
          <span className="w-px h-5 bg-card-border mx-2" />
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => switchDirection(d.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                direction === d.key ? 'bg-surface-hover text-brand-primary' : 'text-gray-400 hover:text-brand-primary'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs-portal text-status-muted">Last synced: {fmtDateTime(data?.last_synced_at)}</span>
          <Button variant="primary" size="sm" icon={RefreshCw} onClick={sync} disabled={syncing || data?.connected === false}>
            {syncing ? 'Syncing…' : 'Sync from Xero'}
          </Button>
        </div>
      </div>

      {data && data.connected === false && (
        <p className="text-xs-portal font-semibold text-status-warning bg-status-warning/10 border border-status-warning/15 rounded-card p-3">
          Xero is not connected. Connect it in Settings → Xero and choose which bank accounts to import.
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton radius="bar" className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 font-semibold py-10 text-center">
          {status === 'unreconciled' ? 'Nothing to reconcile.' : 'No transactions here yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-left">
                {['Date', '', 'From / To', 'Reference', 'Account'].map((h, i) => (
                  <th key={i} className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">{h}</th>
                ))}
                <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3 text-right">Amount</th>
                <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">
                  {status === 'unreconciled' ? 'Suggested' : 'Linked to'}
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-card-border/60 align-top">
                  <td className="py-3 pr-3 text-xs font-semibold whitespace-nowrap">{ukDate(r.date)}</td>
                  <td className="py-3 pr-3">
                    {r.direction === 'in'
                      ? <ArrowDownLeft size={15} className="text-status-success" aria-label="Money in" />
                      : <ArrowUpRight size={15} className="text-status-danger" aria-label="Money out" />}
                  </td>
                  <td className="py-3 pr-3 text-xs font-bold text-brand-primary">{r.contact_name || '—'}</td>
                  <td className="py-3 pr-3 text-xs font-semibold text-gray-400 max-w-[220px] break-words">{r.reference || '—'}</td>
                  <td className="py-3 pr-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{r.account_name || '—'}</td>
                  <td className={`py-3 pr-3 text-xs font-bold text-right tabular-nums ${r.direction === 'in' ? 'text-status-success' : 'text-brand-primary'}`}>
                    {r.direction === 'in' ? '' : '-'}{money(r.amount)}
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {status === 'unreconciled' ? (
                      r.suggestion ? (
                        <div>
                          <div className="font-bold text-brand-primary">{r.suggestion.label}</div>
                          <div className="text-xs-portal text-status-muted">{AS_LABEL[r.suggestion.as]} · {r.suggestion.reason}</div>
                        </div>
                      ) : <span className="text-gray-400 font-semibold">—</span>
                    ) : status === 'reconciled' ? (
                      <div>
                        <div className="font-bold text-brand-primary">{r.linked_to || '—'}</div>
                        <div className="text-xs-portal text-status-muted flex items-center gap-1">
                          {AS_LABEL[r.reconciled_as]}
                          {r.auto_matched && <><Sparkles size={11} /> auto</>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 font-semibold">{r.note || 'Ignored'}</span>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {status === 'unreconciled' ? (
                      <div className="flex gap-1 justify-end">
                        {r.suggestion && (
                          <Button variant="primary" size="sm" icon={Check} disabled={busyId === r.id} onClick={() => confirmSuggestion(r)}>
                            Confirm
                          </Button>
                        )}
                        <Button variant={r.suggestion ? 'ghost' : 'secondary'} size="sm" icon={Link2} disabled={busyId === r.id} onClick={() => setReconcileRow(r)}>
                          Reconcile
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={EyeOff}
                          disabled={busyId === r.id}
                          onClick={() => act(r, `/xero/transactions/${r.id}/ignore`, null, 'Transaction ignored')}
                        >
                          Ignore
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" icon={Undo2} disabled={busyId === r.id} onClick={() => undo(r)}>
                        Undo
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reconcileRow && (
        <ReconcileModal row={reconcileRow} onClose={() => setReconcileRow(null)} onDone={reload} />
      )}
    </div>
  );
};

// One popup: choose what the money was, then who/what it belongs to.
const ReconcileModal = ({ row, onClose, onDone }) => {
  const { addToast } = useToast();
  const kinds = row.direction === 'in' ? ['tenant_rent'] : ['landlord_payout', 'property_expense'];
  const [as, setAs] = useState(row.suggestion?.as && kinds.includes(row.suggestion.as) ? row.suggestion.as : kinds[0]);
  const [tenants, setTenants] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [properties, setProperties] = useState([]);
  const [statements, setStatements] = useState([]);
  const [tenancyId, setTenancyId] = useState(row.suggestion?.tenancy_id ? String(row.suggestion.tenancy_id) : '');
  const [landlordId, setLandlordId] = useState(row.suggestion?.landlord_id ? String(row.suggestion.landlord_id) : '');
  const [propertyId, setPropertyId] = useState('');
  const [statementIds, setStatementIds] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (row.direction === 'in') {
          const res = await api.get('/statements/tenancy-options');
          setTenants(res.data.data || []);
        } else {
          const [l, p, s] = await Promise.all([api.get('/landlords'), api.get('/properties'), api.get('/statements')]);
          setLandlords(l.data.data || []);
          setProperties(p.data.data || []);
          setStatements((s.data.data || []).filter((x) => x.status !== 'paid' && x.landlord_id));
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load options', 'error');
      }
    };
    load();
  }, [row.direction, addToast]);

  const landlordStatements = statements.filter((s) => String(s.landlord_id) === String(landlordId));
  const selectedTotal = landlordStatements.filter((s) => statementIds.includes(s.id)).reduce((a, s) => a + parseFloat(s.net_paid || 0), 0);
  const toggleStatement = (id) => setStatementIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const submit = async (e) => {
    e.preventDefault();
    const body = { as, note };
    if (as === 'tenant_rent') {
      if (!tenancyId) return addToast('Select the tenant', 'warning');
      body.tenancy_id = Number(tenancyId);
    } else if (as === 'landlord_payout') {
      if (!landlordId) return addToast('Select the landlord', 'warning');
      body.landlord_id = Number(landlordId);
      body.statement_ids = statementIds;
    } else {
      if (!propertyId) return addToast('Select the property', 'warning');
      body.property_id = Number(propertyId);
    }
    setSaving(true);
    try {
      await api.post(`/xero/transactions/${row.id}/reconcile`, body);
      addToast('Transaction reconciled', 'success');
      onDone();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reconcile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <Link2 size={18} />
          <span>Reconcile {row.direction === 'in' ? 'money in' : 'money out'} · {money(row.amount)}</span>
        </div>
        <form onSubmit={submit} className="p-6 flex flex-col gap-5">
          <div className="bg-surface-hover/50 border border-card-border rounded-card p-3 text-xs">
            <div className="font-bold text-brand-primary">{row.contact_name || '—'}</div>
            <div className="text-status-muted">{ukDate(row.date)} · {row.reference || 'no reference'} · {row.account_name || ''}</div>
          </div>

          {kinds.length > 1 && (
            <div className="flex gap-2">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAs(k)}
                  className={`flex-1 px-3 py-2 rounded-card text-xs font-bold border cursor-pointer ${
                    as === k ? 'border-brand-accent bg-brand-accent/10 text-brand-accent' : 'border-card-border text-gray-400 hover:text-brand-primary'
                  }`}
                >
                  {AS_LABEL[k]}
                </button>
              ))}
            </div>
          )}

          {as === 'tenant_rent' && (
            <Dropdown
              label="Tenant"
              id="reconcileTenant"
              options={tenants.map((t) => ({ value: String(t.tenancy_id), label: t.label }))}
              value={tenancyId}
              onChange={setTenancyId}
              placeholder="Search and select a tenant..."
              searchable
            />
          )}

          {as === 'landlord_payout' && (
            <>
              <Dropdown
                label="Landlord"
                id="reconcileLandlord"
                options={landlords.map((l) => ({ value: String(l.id), label: l.name }))}
                value={landlordId}
                onChange={(v) => { setLandlordId(v); setStatementIds([]); }}
                placeholder="Search and select a landlord..."
                searchable
              />
              {landlordId && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-status-muted">Statements this payout settles (marked Paid):</p>
                  {landlordStatements.length === 0 ? (
                    <p className="text-xs-portal text-status-muted italic">No unpaid statements for this landlord.</p>
                  ) : landlordStatements.map((s) => (
                    <label key={s.id} className="flex items-center justify-between gap-3 text-xs border border-card-border rounded-card px-3 py-2 cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="accent-brand-accent" checked={statementIds.includes(s.id)} onChange={() => toggleStatement(s.id)} />
                        <span className="font-bold text-brand-primary">{s.statement_number || s.statement_reference}</span>
                        <span className="text-status-muted">{ukDate(s.period_start)} – {ukDate(s.period_end)}</span>
                      </span>
                      <span className="font-bold tabular-nums">{money(s.net_paid)}</span>
                    </label>
                  ))}
                  {statementIds.length > 0 && Math.abs(selectedTotal - row.amount) > 0.009 && (
                    <p className="text-xs-portal font-semibold text-status-warning">
                      Selected statements total {money(selectedTotal)}, but the payment is {money(row.amount)}.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {as === 'property_expense' && (
            <>
              <Dropdown
                label="Property"
                id="reconcileProperty"
                options={properties.map((p) => ({ value: String(p.id), label: `${p.address_line1} · ${p.landlord_name || ''}` }))}
                value={propertyId}
                onChange={setPropertyId}
                placeholder="Search and select a property..."
                searchable
              />
              <p className="text-xs-portal text-status-muted -mt-3">It will be pre-filled as a deduction on this property&apos;s next statement.</p>
            </>
          )}

          <Input id="reconcileNote" label="Note (optional — used as the statement line text for expenses)" value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Reconcile'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
