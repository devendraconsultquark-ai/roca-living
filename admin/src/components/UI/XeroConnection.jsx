import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Unlink, RefreshCw, AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { Button } from './Button';
import { DatePicker } from './DatePicker';
import api, { API_BASE_URL } from '../../utilities/api';

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

  // Surface the outcome of the OAuth round trip, then drop the query params so a
  // refresh doesn't repeat the toast.
  const xeroParam = searchParams.get('xero');
  const reasonParam = searchParams.get('reason');
  useEffect(() => {
    if (!xeroParam) return;
    Promise.resolve().then(() => {
      if (xeroParam === 'connected') {
        addToast('Xero connected successfully', 'success');
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
      <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
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
                Connecting Xero lets Roca Living read the bank transactions behind rent receipts and landlord
                payouts, so payments can be reconciled against tenancies automatically. Access is read-only.
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
                    Connected {fmtDateTime(status.connected_at)} • Read-only access
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

            <div className="border-t border-card-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xs font-bold text-status-muted uppercase tracking-wider">Bank Accounts</p>
                {banks?.total_balance !== null && banks?.total_balance !== undefined && (
                  <p className="text-xs font-bold text-brand-primary">Total {money(banks.total_balance)}</p>
                )}
              </div>

              {banksLoading ? (
                <p className="text-xs text-gray-400 font-semibold py-3 text-center">Loading bank accounts…</p>
              ) : !banks?.accounts?.length ? (
                <p className="text-xs text-gray-400 font-semibold py-3 text-center">
                  No bank accounts were returned by Xero for this organisation.
                </p>
              ) : (
                <div className="flex flex-col">
                  {banks.accounts.map((a) => (
                    <div key={a.account_id} className="flex items-center justify-between gap-4 py-2.5 border-b border-card-border/60 last:border-0">
                      <label className="flex items-center gap-3 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-brand-accent cursor-pointer"
                          checked={importIds.includes(a.account_id)}
                          onChange={() => toggleImport(a.account_id)}
                          aria-label={`Import transactions from ${a.name}`}
                        />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-primary truncate">{a.name}</p>
                        <p className="text-2xs text-gray-400 font-semibold mt-0.5">
                          {[a.code, a.bank_account_number, a.currency].filter(Boolean).join(' • ') || '—'}
                        </p>
                      </div>
                      </label>
                      <p className="text-xs font-bold text-brand-primary shrink-0">{money(a.balance)}</p>
                    </div>
                  ))}
                </div>
              )}
              {banks?.accounts?.length > 0 && (
                <div className="flex flex-wrap items-end justify-between gap-4 mt-4 pt-4 border-t border-card-border">
                  <p className="text-xs-portal text-status-muted max-w-md">
                    Tick the accounts whose money in / out should be imported (e.g. the Parsons House rent account and
                    ROCA operating account). Transactions dated before the start date are not imported.
                  </p>
                  <div className="flex items-end gap-3">
                    <DatePicker label="Import from" id="xeroImportFrom" value={importFrom} onChange={setImportFrom} />
                    <Button variant="primary" size="sm" onClick={saveImport} disabled={savingImport}>
                      {savingImport ? 'Saving…' : 'Save import settings'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
