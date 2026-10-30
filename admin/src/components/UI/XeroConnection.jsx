import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Unlink, RefreshCw, AlertTriangle, CheckCircle2, Landmark, XCircle, MinusCircle, ChevronDown } from 'lucide-react';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { Button } from './Button';
import { DatePicker } from './DatePicker';
import { Dropdown } from './Dropdown';
import api, { API_BASE_URL } from '../../utilities/api';
import { InfoTip } from './InfoTip';

const money = (v) =>
  v === null || v === undefined
    ? '—'
    : `£${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const CALLBACK_ERRORS = {
  not_configured: 'Xero is not configured on the server (missing client credentials).',
  declined: 'Authorisation was declined in Xero.',
  state: 'The Xero sign-in could not be verified. Please try connecting again.',
  exchange: 'Xero rejected the authorisation code. Please try again.',
  no_organisation: 'No Xero organisation was granted access.'
};

// Step 1: where the money is (bank accounts, chosen by Xero id).
const BANK_FIELDS = [
  { key: 'xeroRentBankAccountId', label: 'Tenants Pay Rent Into', hint: 'The client (rent) account' },
  { key: 'xeroFeeBankAccountId', label: "ROCA's Fee Goes To", hint: "ROCA's own account: the fee moves here when you approve rent" },
];
// Step 2: how Xero records it (accounting codes; your accountant confirms once).
const CODE_FIELDS = [
  { key: 'xeroRentIncomeAccountCode', label: 'Rent', hint: 'Internal rent invoices (never sent to tenants)' },
  { key: 'xeroFeeIncomeAccountCode', label: "ROCA's Fee", hint: 'Management fee income' },
  { key: 'xeroLandlordBillAccountCode', label: 'Owed to Landlords', hint: 'Landlord bills (their share of the rent)' },
  { key: 'xeroLandlordExpenseAccountCode', label: 'Repairs & Costs', hint: 'Taken off landlords; contractor bills use it too' },
];
const ACCOUNT_FIELDS = [...BANK_FIELDS, ...CODE_FIELDS];

// A numbered setup step with a Done / Needs Setup marker.
const Step = ({ n, title, sub, done, children }) => (
  <div className="border border-card-border rounded-xl p-4 flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${done ? 'bg-status-success text-white' : 'bg-brand-accent/10 text-brand-accent'}`}>
          {done ? '✓' : n}
        </span>
        <div>
          <p className="text-sm font-bold text-brand-primary">{title}</p>
          <p className="text-xs text-status-muted mt-0.5">{sub}</p>
        </div>
      </div>
      <span className={`text-2xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${done ? 'bg-status-success-bg text-status-success' : 'bg-status-warning/10 text-status-warning'}`}>
        {done ? 'Done' : 'Needs Setup'}
      </span>
    </div>
    {children}
  </div>
);

// Xero connection panel (integration phase X1). Our platform stays the property
// -management source of truth; Xero is the money source of truth.
export const XeroConnection = () => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState(null); // { accounts, total_balance }
  const [banksLoading, setBanksLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Which bank accounts are imported into Accounting → Bank Transactions
  const [importIds, setImportIds] = useState([]);
  const [importFrom, setImportFrom] = useState('');
  const [savingImport, setSavingImport] = useState(false);
  // Organisation choice, Xero account settings, access test
  const [orgs, setOrgs] = useState(null);
  const [orgChoice, setOrgChoice] = useState('');
  const [chartAccounts, setChartAccounts] = useState(null);
  const [accountSettings, setAccountSettings] = useState({});
  const [savingAccounts, setSavingAccounts] = useState(false);
  const [diag, setDiag] = useState(null);
  const [testing, setTesting] = useState(false);
  // Internal rent invoices in Xero
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [invoicesFrom, setInvoicesFrom] = useState('');
  const [savingFrom, setSavingFrom] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Surface the outcome of the OAuth round trip, then drop the query params so a
  // refresh doesn't repeat the toast.
  const xeroParam = searchParams.get('xero');
  const reasonParam = searchParams.get('reason');
  useEffect(() => {
    if (!xeroParam) return;
    Promise.resolve().then(() => {
      if (xeroParam === 'connected') {
        addToast('Xero connected successfully', 'success');
      } else if (xeroParam === 'choose_org') {
        addToast('Xero connected — please confirm which organisation to use', 'warning');
      } else {
        addToast(CALLBACK_ERRORS[reasonParam] || 'Could not connect to Xero', 'error');
      }
      setSearchParams({}, { replace: true });
    });
  }, [xeroParam, reasonParam, addToast, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await api.get('/xero/status');
        if (!cancelled) setStatus(res.data.data);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const connected = status?.connected;

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setBanksLoading(true);
      api
        .get('/xero/bank-accounts', { skipInterceptorError: true })
        .then((res) => { if (!cancelled) setBanks(res.data.data); })
        .catch(() => { if (!cancelled) setBanks(null); })
        .finally(() => { if (!cancelled) setBanksLoading(false); });
    });
    return () => { cancelled = true; };
  }, [connected, reloadKey]);

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    api
      .get('/xero/import-settings', { skipInterceptorError: true })
      .then((res) => {
        if (cancelled) return;
        setImportIds((res.data.data.accounts || []).map((a) => a.account_id));
        setImportFrom(res.data.data.import_from || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [connected, reloadKey]);

  useEffect(() => {
    if (!connected || !status?.needs_org_choice) return undefined;
    let cancelled = false;
    api.get('/xero/organisations', { skipInterceptorError: true })
      .then((res) => {
        if (cancelled) return;
        setOrgs(res.data.data);
        setOrgChoice(res.data.data.find((o) => o.current)?.tenant_id || '');
      })
      .catch(() => { if (!cancelled) setOrgs([]); });
    return () => { cancelled = true; };
  }, [connected, status?.needs_org_choice, reloadKey]);

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    Promise.all([
      api.get('/xero/accounts', { skipInterceptorError: true }),
      api.get('/xero/account-settings', { skipInterceptorError: true }),
    ])
      .then(([acc, set]) => {
        if (cancelled) return;
        setChartAccounts(acc.data.data);
        setAccountSettings(set.data.data || {});
      })
      .catch(() => { if (!cancelled) setChartAccounts([]); });
    return () => { cancelled = true; };
  }, [connected, reloadKey]);

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    api.get('/xero/rent-invoices/settings', { skipInterceptorError: true })
      .then((res) => {
        if (cancelled) return;
        setInvoiceInfo(res.data.data);
        setInvoicesFrom(res.data.data.invoices_from || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [connected, reloadKey]);

  // The go-live date: rent months before it never get a Xero invoice.
  const saveInvoicesFrom = async () => {
    setSavingFrom(true);
    try {
      await api.put('/xero/rent-invoices/settings', { invoices_from: invoicesFrom });
      addToast('Saved — rent invoices start from this date', 'success');
      const fresh = await api.get('/xero/rent-invoices/settings', { skipInterceptorError: true });
      setInvoiceInfo(fresh.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save the date', 'error');
    } finally {
      setSavingFrom(false);
    }
  };

  const chooseOrg = async () => {
    try {
      const res = await api.put('/xero/organisation', { tenant_id: orgChoice });
      addToast(res.data.message, 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to choose the organisation', 'error');
    }
  };

  const saveAccounts = async () => {
    setSavingAccounts(true);
    try {
      const body = Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f.key, accountSettings[f.key] || '']));
      const res = await api.put('/xero/account-settings', body);
      addToast(res.data.message || 'Xero accounts saved', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save the Xero accounts', 'error');
    } finally {
      setSavingAccounts(false);
    }
  };

  const testAccess = async () => {
    setTesting(true);
    try {
      const res = await api.get('/xero/diagnostics', { skipInterceptorError: true });
      setDiag(res.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not test the Xero connection', 'error');
    } finally {
      setTesting(false);
    }
  };

  const accountOptions = () => (chartAccounts || [])
    .filter((a) => !!a.code)
    .map((a) => ({ value: a.code, label: `${a.code} — ${a.name}`, group: a.class }));
  // Bank accounts are chosen by their Xero id (some have no code).
  const bankOptions = () => (chartAccounts || [])
    .filter((a) => a.type === 'BANK')
    .map((a) => ({ value: a.account_id, label: a.code ? `${a.code} — ${a.name}` : a.name }));

  const toggleImport = (id) => setImportIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const saveImport = async () => {
    setSavingImport(true);
    try {
      const accounts = (banks?.accounts || [])
        .filter((a) => importIds.includes(a.account_id))
        .map((a) => ({ account_id: a.account_id, name: a.name }));
      await api.put('/xero/import-settings', { accounts, import_from: importFrom || undefined });
      addToast('Import settings saved — use Accounting → Bank Transactions → Sync from Xero', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save import settings', 'error');
    } finally {
      setSavingImport(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect Xero',
      message: 'Roca Living will stop reading bank transactions from Xero until you reconnect. No data in Xero is changed.',
      variant: 'danger',
      confirmText: 'Disconnect'
    });
    if (!ok) return;
    try {
      await api.delete('/xero/disconnect');
      addToast('Xero disconnected', 'success');
      setBanks(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to disconnect Xero', 'error');
    }
  };

  return (
    <div className="card-bg border border-card-border rounded-card p-6 md:p-8 shadow-premium flex flex-col gap-5">
      <h3 className="text-sm-portal font-bold text-brand-primary capitalize flex items-center gap-2 select-none">
        <Landmark size={16} className="text-brand-accent" />
        Accounting Integration — Xero
      </h3>

      <div className="border-t border-card-border pt-5">
        {loading ? (
          <p className="text-xs text-gray-400 font-semibold py-4 text-center">Checking Xero connection…</p>
        ) : !status?.configured ? (
          <div className="flex items-start gap-3 bg-status-warning/5 border border-status-warning/20 rounded-xl p-4">
            <AlertTriangle size={18} className="text-status-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-brand-primary">Xero is not configured on this server</p>
              <p className="text-2xs text-status-muted font-semibold mt-1">
                Add XERO_CLIENT_ID, XERO_CLIENT_SECRET and XERO_REDIRECT_URI to the server environment, then restart it.
              </p>
            </div>
          </div>
        ) : !connected ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-brand-primary">
                {status.status === 'needs_reauth' ? 'The Xero connection has expired' : 'Not connected'}
              </p>
              <p className="text-2xs text-status-muted font-semibold mt-1 max-w-2xl">
                Connect Xero to match rent and payouts automatically.
              </p>
            </div>
            {/* Full-page navigation, not XHR: the OAuth handshake must leave the SPA. */}
            <div>
              <a
                href={`${API_BASE_URL}/xero/connect`}
                className="inline-flex items-center gap-2 bg-brand-accent text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Link2 size={16} />
                {status.status === 'needs_reauth' ? 'Reconnect Xero' : 'Connect Xero'}
              </a>
              <p className="text-2xs text-status-muted font-semibold mt-2 max-w-2xl flex items-center gap-1.5">
                Best done by the Xero account owner.
                <InfoTip text='If Xero sends a verification email, the owner approves it, then presses "Continue granting access". It then stays connected.' />
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-status-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-brand-primary">{status.tenant_name || 'Connected organisation'}</p>
                  <p className="text-2xs text-status-muted font-semibold mt-1">
                    Connected {fmtDateTime(status.connected_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => setReloadKey((k) => k + 1)}>
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" icon={Unlink} className="text-status-danger" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </div>

            {status.missing_scopes?.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-status-warning/5 border border-status-warning/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-status-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-brand-primary">Reconnect Xero to grant the new permissions</p>
                    <p className="text-2xs text-status-muted font-semibold mt-1">
                      Roca Living now also needs: {status.missing_scopes.join(', ')}. Reconnecting keeps your settings.
                    </p>
                  </div>
                </div>
                <a
                  href={`${API_BASE_URL}/xero/connect`}
                  className="inline-flex items-center gap-2 bg-brand-accent text-white font-semibold text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Link2 size={16} />
                  Reconnect Xero
                </a>
              </div>
            )}

            {status.needs_org_choice && (
              <div className="flex flex-col gap-3 bg-status-warning/5 border border-status-warning/20 rounded-xl p-4">
                <p className="text-xs font-bold text-brand-primary">Which Xero organisation should Roca Living use?</p>
                <p className="text-2xs text-status-muted font-semibold">
                  This Xero login can see more than one organisation. Choose ROCA Living's own.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-full sm:w-80">
                    <Dropdown
                      id="xeroOrganisation"
                      options={(orgs || []).map((o) => ({ value: o.tenant_id, label: o.name }))}
                      value={orgChoice}
                      onChange={setOrgChoice}
                      placeholder={orgs ? 'Choose the organisation' : 'Loading…'}
                    />
                  </div>
                  <Button variant="primary" size="sm" onClick={chooseOrg} disabled={!orgChoice}>Use this organisation</Button>
                </div>
              </div>
            )}

            {(() => {
              const step1 = BANK_FIELDS.every((f) => accountSettings[f.key]);
              const step2 = CODE_FIELDS.every((f) => accountSettings[f.key]);
              const step3 = !!invoiceInfo?.invoices_from;
              const balanceOf = (id) => banks?.accounts?.find((a) => a.account_id === id)?.balance;
              const field = (f, options) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <Dropdown
                    id={f.key}
                    label={f.label}
                    searchable
                    options={options}
                    value={accountSettings[f.key] || ''}
                    onChange={(v) => setAccountSettings((st) => ({ ...st, [f.key]: v }))}
                    placeholder="Choose…"
                  />
                  <p className="text-xs text-status-muted">
                    {f.hint}
                    {f.key.endsWith('BankAccountId') && balanceOf(accountSettings[f.key]) !== undefined ? ` · balance ${money(balanceOf(accountSettings[f.key]))}` : ''}
                  </p>
                </div>
              );
              return (
                <>
                  {chartAccounts === null ? (
                    <p className="text-xs text-gray-400 font-semibold py-2">Loading Xero accounts…</p>
                  ) : (
                    <>
                      <Step n={1} title="Where the Money Is" sub="The two bank accounts in Xero: rent comes into one, ROCA's fee moves to the other." done={step1}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{BANK_FIELDS.map((f) => field(f, bankOptions()))}</div>
                        <div><Button variant="primary" size="sm" onClick={saveAccounts} disabled={savingAccounts}>{savingAccounts ? 'Saving…' : 'Save'}</Button></div>
                      </Step>

                      <Step n={2} title="How Xero Records It" sub="The accounting codes for rent, ROCA's fee, landlords and repairs. Your accountant confirms these once." done={step2}>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{CODE_FIELDS.map((f) => field(f, accountOptions()))}</div>
                        <div><Button variant="primary" size="sm" onClick={saveAccounts} disabled={savingAccounts}>{savingAccounts ? 'Saving…' : 'Save'}</Button></div>
                      </Step>
                    </>
                  )}

                  <Step n={3} title="Rent Invoices" sub="Roca Living puts each month's rent into Xero 14 days ahead, so Xero can match the tenant's payment. Never sent to tenants." done={step3}>
                    <div className="flex flex-wrap items-end gap-3">
                      <DatePicker label="Start From" id="xeroInvoicesFrom" value={invoicesFrom} onChange={setInvoicesFrom}
                        hint="Rent months before this date never get a Xero invoice." />
                      <Button variant="primary" size="sm" onClick={saveInvoicesFrom} disabled={savingFrom || !invoicesFrom || invoicesFrom === invoiceInfo?.invoices_from}>
                        {savingFrom ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    {!accountSettings.xeroRentIncomeAccountCode && (
                      <p className="text-xs text-status-warning">Choose the "Rent" code in step 2 first.</p>
                    )}
                    {invoiceInfo && (
                      <p className="text-xs text-status-muted">
                        {invoiceInfo.counts.created || 0} rent invoice{invoiceInfo.counts.created === 1 ? '' : 's'} waiting in Xero
                        {invoiceInfo.counts.failed ? <span className="text-status-danger"> · {invoiceInfo.counts.failed} failed (see Rent Cycle)</span> : ''}
                        {invoiceInfo.counts.attention ? <span className="text-status-warning"> · {invoiceInfo.counts.attention} need a look</span> : ''}
                        {invoiceInfo.last ? ` · last checked ${fmtDateTime(invoiceInfo.last.at)}` : ''}
                      </p>
                    )}
                  </Step>
                </>
              );
            })()}

            <div className="border-t border-card-border pt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowTroubleshooting((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-bold text-status-muted cursor-pointer hover:text-brand-primary self-start"
                aria-expanded={showTroubleshooting}
              >
                <ChevronDown size={14} className={`transition-transform ${showTroubleshooting ? 'rotate-180' : ''}`} />
                Advanced: Bank Transaction Import and Troubleshooting
              </button>
              {showTroubleshooting && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold text-brand-primary flex items-center gap-1.5">
                      Import Bank Transactions
                      <InfoTip text="Tick accounts whose Xero transactions show in Accounting → Bank Transactions. Not needed for Rent Cycle." />
                    </p>
                    {banksLoading ? (
                      <p className="text-xs text-gray-400 font-semibold py-2">Loading bank accounts…</p>
                    ) : !banks?.accounts?.length ? (
                      <p className="text-xs text-gray-400 font-semibold py-2">No bank accounts were returned by Xero for this organisation.</p>
                    ) : (
                      <>
                        {banks.accounts.map((a) => (
                          <label key={a.account_id} className="flex items-center justify-between gap-4 py-2 border-b border-card-border/60 last:border-0 cursor-pointer">
                            <span className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                className="accent-brand-accent cursor-pointer"
                                checked={importIds.includes(a.account_id)}
                                onChange={() => toggleImport(a.account_id)}
                                aria-label={`Import transactions from ${a.name}`}
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-bold text-brand-primary truncate">{a.name}</span>
                                <span className="block text-2xs text-gray-400 font-semibold">{[a.code, a.bank_account_number, a.currency].filter(Boolean).join(' • ') || '—'}</span>
                              </span>
                            </span>
                            <span className="text-xs font-bold text-brand-primary shrink-0">{money(a.balance)}</span>
                          </label>
                        ))}
                        <div className="flex flex-wrap items-end gap-3">
                          <DatePicker label="Import From" id="xeroImportFrom" value={importFrom} onChange={setImportFrom} />
                          <Button variant="secondary" size="sm" onClick={saveImport} disabled={savingImport}>
                            {savingImport ? 'Saving…' : 'Save Import Settings'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-3">
                    <p className="text-xs text-status-muted flex items-center gap-1.5">Test Xero Access <InfoTip text="Checks what Roca Living can read in Xero. Nothing is changed." /></p>
                    <Button variant="secondary" size="sm" onClick={testAccess} disabled={testing}>
                      {testing ? 'Testing…' : 'Test Xero Access'}
                    </Button>
                  </div>
                </div>
              )}
              {showTroubleshooting && diag && (
                <div className="flex flex-col">
                  {diag.checks.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-4 py-2 border-b border-card-border/60 last:border-0">
                      <span className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                        {c.ok === true ? <CheckCircle2 size={15} className="text-status-success" />
                          : c.ok === false ? <XCircle size={15} className="text-status-danger" />
                          : <MinusCircle size={15} className="text-status-muted" />}
                        {c.name}
                      </span>
                      <span className="text-xs-portal text-status-muted font-semibold text-right">
                        {c.message}{c.http_status ? ` (HTTP ${c.http_status})` : ''}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs-portal text-status-muted mt-2 break-words">
                    Permissions granted: {diag.scopes.join(', ') || '—'}
                    {diag.missing_scopes.length > 0 ? ` · Missing: ${diag.missing_scopes.join(', ')}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
