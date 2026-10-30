import { useEffect, useState } from 'react';
import { X, Eye, FileSpreadsheet } from 'lucide-react';
import { useToast } from './ToastContext';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { DatePicker } from './DatePicker';
import api from '../../utilities/api';
import { InfoTip } from './InfoTip';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

// New statement from approved rent (separate trial flow; the existing Generate
// Statement is unchanged). Pick a tenancy with approved rent, a period, then
// preview or generate.
export const ApprovedRentStatementModal = ({ onClose, onCreated }) => {
  const { addToast } = useToast();
  const [candidates, setCandidates] = useState(null);
  const [tenancyId, setTenancyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/approved-statements/candidates', { skipInterceptorError: true })
      .then((res) => { if (!cancelled) setCandidates(res.data.data); })
      .catch(() => { if (!cancelled) setCandidates([]); });
    return () => { cancelled = true; };
  }, []);

  const chosen = (candidates || []).find((c) => String(c.tenancy_id) === String(tenancyId));
  const choose = (id) => {
    setTenancyId(id);
    const c = (candidates || []).find((x) => String(x.tenancy_id) === String(id));
    if (c) { setFrom(c.first_received); setTo(c.last_received); }
  };
  const body = () => ({ tenancy_id: Number(tenancyId), period_start: from, period_end: to });

  const preview = async () => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await api.post('/approved-statements/preview', body(), { responseType: 'blob', skipInterceptorError: true });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (tab) tab.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      tab?.close();
      let msg = 'Failed to preview the statement';
      try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch { /* not JSON */ }
      addToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/approved-statements', body());
      addToast(res.data.message, 'success');
      onCreated();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create the statement', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <FileSpreadsheet size={18} />
          <span>Statement from Approved Rent</span>
          <InfoTip text="Built from rent approved in Rent Cycle: rent, ROCA's fee and the landlord's net. Numbered AR-… Separate from Generate Statement." className="text-white/80" />
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {candidates === null ? (
            <p className="text-sm text-status-muted py-4 text-center">Loading…</p>
          ) : !candidates.length ? (
            <p className="text-sm text-status-muted py-4 text-center">No approved rent waiting for a statement. Approve rent in Accounting → Rent Cycle first.</p>
          ) : (
            <>
              <Dropdown
                id="approvedTenancy"
                label="Tenancy"
                options={candidates.map((c) => ({
                  value: String(c.tenancy_id),
                  label: `${c.landlord_name || 'Landlord'} · ${c.flat} (${c.tenant_name || 'Tenant'}) · ${c.payments} payment(s)`,
                }))}
                value={tenancyId}
                onChange={choose}
                placeholder="Choose the tenancy"
              />
              {chosen && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DatePicker label="Period from" id="approvedFrom" value={from} onChange={setFrom} />
                    <DatePicker label="Period to" id="approvedTo" min={from || null} value={to} onChange={setTo} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-surface-light border border-card-border rounded-lg p-3">
                      <p className="text-xs text-status-muted">Rent received</p>
                      <p className="font-bold text-brand-primary">{money(chosen.total_rent)}</p>
                    </div>
                    <div className="bg-surface-light border border-card-border rounded-lg p-3">
                      <p className="text-xs text-status-muted">Management fee</p>
                      <p className="font-bold text-brand-primary">{money(chosen.total_fee)}</p>
                    </div>
                    <div className="bg-surface-light border border-card-border rounded-lg p-3">
                      <p className="text-xs text-status-muted">To the landlord</p>
                      <p className="font-bold text-brand-primary">{money(chosen.net)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-status-muted">
                    Approved rent received {ukDate(chosen.first_received)} – {ukDate(chosen.last_received)}. The statement includes payments inside the chosen period.
                  </p>
                </>
              )}
            </>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-card-border">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="secondary" icon={Eye} onClick={preview} disabled={busy || !chosen || !from || !to}>Preview PDF</Button>
            <Button variant="primary" onClick={generate} disabled={busy || !chosen || !from || !to}>{busy ? 'Working…' : 'Generate'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
