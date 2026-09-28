import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, AlertTriangle, X, Eye } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { Dropdown } from './Dropdown';
import { Skeleton } from './Skeleton';
import { useToast } from './ToastContext';
import api from '../../utilities/api';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
const money = (v) => {
  const n = Math.round(num(v) * 100) / 100;
  const text = `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${text}` : text;
};

const HEADER_FIELDS = [
  { key: 'landlord_name', label: 'Landlord / Company Name', required: true },
  { key: 'landlord_address', label: 'Landlord Address (one line per row)', multiline: true },
  { key: 'statement_number', label: 'Statement Number', required: true },
  { key: 'invoice_number', label: 'Invoice Number' },
  { key: 'nrl_number', label: 'NRL Number' },
  { key: 'landlord_reference', label: 'Landlord Reference' },
  { key: 'property_reference', label: 'Property Reference' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'tenant_name', label: 'Tenant Name' },
  { key: 'tenancy_type', label: 'Tenancy Type' },
];

const SECTIONS = [
  { key: 'income_lines', title: 'Income', hint: 'Rent received for the period. Add credits, e.g. a void period rent credit.' },
  { key: 'fee_lines', title: 'ROCA Fees (invoice)', hint: 'Becomes the fee invoice. The fee is worked out from the income and updates when you change the rent — type your own amount to override it. Use the discount column to reduce or waive a fee.', fee: true },
  { key: 'expenditure_lines', title: 'Expenditure', hint: 'Costs deducted from the landlord: expenses added on the apartment (Properties → apartment → Expenses), completed repairs and Xero expenses fill in here. Use a negative amount for a rebate.' },
];

// Statements → select landlord & unit → choose the rent month → everything
// auto-fills → admin checks/edits → Preview → Generate (statement + fee invoice
// PDF in ROCA Living's own design).
export const TenantStatementModal = ({ onClose, onGenerated }) => {
  const { addToast } = useToast();
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [tenancyId, setTenancyId] = useState('');
  const [form, setForm] = useState(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [lastSeq, setLastSeq] = useState('');
  const [savingSeq, setSavingSeq] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/statements/tenancy-options');
        setOptions(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load tenants', 'error');
      } finally {
        setLoadingOptions(false);
      }
    };
    load();
  }, [addToast]);

  const loadAutofill = async (id, periodStart) => {
    setLoadingForm(true);
    try {
      const res = await api.get(`/statements/tenancy-autofill/${id}`, {
        params: periodStart ? { period_start: periodStart } : {},
      });
      setForm(res.data.data);
      setLastSeq(res.data.data.last_statement_seq ?? '');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load tenant details', 'error');
      setForm(null);
    } finally {
      setLoadingForm(false);
    }
  };

  const selectTenant = async (id) => {
    setTenancyId(id);
    setForm(null);
    setPeriods([]);
    if (!id) return;
    try {
      const res = await api.get(`/statements/tenancy-periods/${id}`);
      setPeriods(res.data.data.periods || []);
      loadAutofill(id, res.data.data.next_period_start || undefined);
    } catch {
      loadAutofill(id);
    }
  };

  // "Last statement number issued by hand" for this tenancy, so numbering
  // continues from the client's own numbers (e.g. 5 → next is PH_19_0006).
  const saveLastSeq = async () => {
    setSavingSeq(true);
    try {
      await api.patch(`/tenancies/${tenancyId}/opening`, { last_statement_seq: lastSeq === '' ? null : Number(lastSeq) });
      addToast('Numbering updated', 'success');
      loadAutofill(tenancyId, form?.period_start);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update numbering', 'error');
    } finally {
      setSavingSeq(false);
    }
  };

  // Opens the exact PDF for the form in a new tab, without saving anything.
  const preview = async () => {
    const tab = window.open('', '_blank');
    setPreviewing(true);
    try {
      const res = await api.post('/statements/preview', { ...form, tenancy_id: Number(tenancyId) }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (tab) tab.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      if (tab) tab.close();
      let message = 'Failed to preview the statement';
      try { message = JSON.parse(await err.response?.data?.text())?.message || message; } catch { /* not JSON */ }
      addToast(message, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // The management fee follows the income (8% of it) until the admin types a
  // fee amount themselves; from then on it is left as entered.
  const withFee = (f) => {
    if (f.fee_manual || !f.fee_lines.length) return f;
    const income = f.income_lines.reduce((s, l) => s + num(l.amount), 0);
    const fee = Math.round(income * num(f.mgmt_fee_pct)) / 100;
    return { ...f, fee_lines: f.fee_lines.map((l, i) => (i === 0 ? { ...l, amount: fee } : l)) };
  };
  const setLine = (section, index, key, value) => setForm((f) => withFee({
    ...f,
    ...(section === 'fee_lines' && key === 'amount' ? { fee_manual: true } : {}),
    [section]: f[section].map((l, i) => (i === index ? { ...l, [key]: value } : l)),
  }));
  const addLine = (section) => setForm((f) => ({
    ...f,
    [section]: [...f[section], section === 'fee_lines' ? { description: '', amount: '', discount: '' } : { description: '', amount: '' }],
  }));
  const removeLine = (section, index) => setForm((f) => withFee({ ...f, [section]: f[section].filter((_, i) => i !== index) }));

  // Live totals — the server recomputes the same figures on Generate.
  const totals = form ? (() => {
    const income = form.income_lines.reduce((s, l) => s + num(l.amount), 0);
    const fees = form.fee_lines.reduce((s, l) => s + num(l.amount) - num(l.discount), 0);
    const other = form.expenditure_lines.reduce((s, l) => s + num(l.amount), 0);
    const closing = num(form.previous_balance) + income - fees - other;
    return { income, fees, other, closing, payout: Math.max(0, closing) };
  })() : null;

  const blocked = !form || !form.landlord_id || !!form.existing_statement_number || !!form.missing_unit_codes;

  const submit = async (e) => {
    e.preventDefault();
    if (blocked) return;
    setSaving(true);
    try {
      await api.post('/statements/generate', { ...form, tenancy_id: Number(tenancyId) });
      addToast(`Statement ${form.statement_number} generated`, 'success');
      onGenerated();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to generate statement', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <Calendar size={18} />
          <span>Generate Landlord Statement</span>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
          <div className="bg-status-info-bg p-4 rounded-card border border-status-info/15 flex flex-col gap-3">
            <Dropdown
              label="Landlord & Unit"
              id="tenancySelect"
              options={options.map((o) => ({ value: String(o.tenancy_id), label: o.label }))}
              value={tenancyId}
              onChange={selectTenant}
              placeholder={loadingOptions ? 'Loading landlords...' : 'Search and select a landlord...'}
              searchable
              clearable
              disabled={loadingOptions}
            />
            <p className="text-xs-portal text-status-info italic">
              Only apartments ROCA Living manages are listed. Choose the rent month — landlord, references, rent, the 8% fee and expenses fill in automatically. Check them, preview, then generate.
            </p>
          </div>

          {loadingForm && (
            <div className="flex flex-col gap-3">
              <Skeleton radius="card" className="h-24 w-full" />
              <Skeleton radius="card" className="h-40 w-full" />
            </div>
          )}

          {form && !loadingForm && (
            <>
              {!form.landlord_id && (
                <Warning danger text="This property has no landlord linked. Add the landlord to the property first." />
              )}
              {form.existing_statement_number && (
                <Warning danger text={`Statement ${form.existing_statement_number} already covers this rent month. Choose another month.`} />
              )}
              {form.missing_unit_codes && (
                <Warning text="This apartment has no block code and apartment number (e.g. PH + 33), so no statement number can be made. Check it is linked to its ROCA Estates apartment." />
              )}
              {form.tenant_credit > 0 && (
                <p className="text-xs-portal font-semibold text-status-info bg-status-info-bg border border-status-info/15 rounded-card p-3">
                  The tenant has {money(form.tenant_credit)} credit (paid in advance). It will be included on the statement of the month it pays — no fee is taken on it until then.
                </p>
              )}
              {form.checks?.length > 0 && (
                <div className="flex gap-3 items-start rounded-card p-4 border bg-status-warning/10 border-status-warning/15">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-status-warning" />
                  <div className="text-xs-portal font-semibold text-status-warning">
                    <p className="mb-1">Check before issuing:</p>
                    <ul className="list-disc pl-4 flex flex-col gap-0.5">
                      {form.checks.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              )}
              {!form.rent_recorded && (
                <Warning text="No rent payment is recorded for this period — the rent due is shown. Check the rent was received, or record the payment first." />
              )}

              <div className="border-b pb-4 border-card-border">
                <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider mb-1">Rent Month</h3>
                <p className="text-xs-portal text-status-muted mb-3">
                  Which rent period this statement is for. Months that already have a statement are shown but can't be chosen again.
                </p>
                <Dropdown
                  id="rentMonth"
                  options={periods.map((p) => ({
                    value: p.start,
                    label: `${ukDate(p.start)} – ${ukDate(p.end)}${p.statement_number ? ` · ${p.statement_number} issued` : ''}`,
                    disabled: !!p.statement_number && p.start !== form.period_start,
                  }))}
                  value={form.period_start}
                  onChange={(v) => v && v !== form.period_start && loadAutofill(tenancyId, v)}
                  placeholder={`${ukDate(form.period_start)} – ${ukDate(form.period_end)}`}
                />
              </div>

              <div className="border-b pb-4 border-card-border">
                <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider mb-3">Statement Details</h3>
                <div className="flex flex-wrap items-end gap-3 mb-4 bg-surface-hover/50 border border-card-border rounded-card p-3">
                  <div className="w-56">
                    <Input
                      id="lastSeq"
                      label="Last number issued by hand"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 5 for _0005"
                      value={lastSeq}
                      onChange={(e) => setLastSeq(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={saveLastSeq} disabled={savingSeq}>
                    {savingSeq ? 'Saving…' : 'Save numbering'}
                  </Button>
                  <p className="text-xs-portal text-status-muted flex-1 min-w-48">
                    If ROCA already issued statements for this apartment before this system, enter the last number so this one continues after it.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {HEADER_FIELDS.map((f) => (f.multiline ? (
                    <div key={f.key}>
                      <label htmlFor={f.key} className="block text-xs font-semibold text-status-muted mb-1">{f.label}</label>
                      <textarea
                        id={f.key}
                        rows={4}
                        value={form[f.key] || ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-none"
                      />
                    </div>
                  ) : (
                    <Input
                      key={f.key}
                      id={f.key}
                      label={f.label}
                      required={!!f.required}
                      value={form[f.key] || ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )))}
                  <DatePicker
                    label="Tenancy Start Date"
                    id="tenancyStart"
                    value={form.tenancy_start_date || ''}
                    onChange={(v) => setField('tenancy_start_date', v)}
                  />
                </div>
              </div>


              {SECTIONS.map((section) => (
                <div key={section.key} className="border-b pb-4 border-card-border">
                  <div className="flex items-end justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">{section.title}</h3>
                      <p className="text-xs-portal text-status-muted">{section.hint}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={() => addLine(section.key)}>
                      Add line
                    </Button>
                  </div>
                  {form[section.key].length === 0 ? (
                    <p className="text-xs-portal text-status-muted italic">No lines.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {form[section.key].map((line, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <Input
                              id={`${section.key}-desc-${i}`}
                              value={line.description}
                              placeholder="Description"
                              onChange={(e) => setLine(section.key, i, 'description', e.target.value)}
                            />
                          </div>
                          <div className="w-28 shrink-0">
                            <Input
                              id={`${section.key}-amount-${i}`}
                              type="number"
                              step="0.01"
                              value={line.amount}
                              placeholder="Amount"
                              onChange={(e) => setLine(section.key, i, 'amount', e.target.value)}
                            />
                          </div>
                          {section.fee && (
                            <div className="w-28 shrink-0">
                              <Input
                                id={`${section.key}-discount-${i}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.discount}
                                placeholder="Discount"
                                onChange={(e) => setLine(section.key, i, 'discount', e.target.value)}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeLine(section.key, i)}
                            className="p-2 text-gray-400 hover:text-status-danger cursor-pointer shrink-0"
                            aria-label="Remove line"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-card p-4 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 flex flex-col gap-3">
                  <Input
                    label="Balance from Previous Statement (£)"
                    id="previousBalance"
                    type="number"
                    step="0.01"
                    value={form.previous_balance}
                    onChange={(e) => setField('previous_balance', e.target.value)}
                  />
                  <div>
                    <label htmlFor="invoiceNotes" className="block text-xs font-semibold text-status-muted mb-1">Invoice Notes (optional)</label>
                    <textarea
                      id="invoiceNotes"
                      rows={2}
                      value={form.invoice_notes || ''}
                      onChange={(e) => setField('invoice_notes', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-none"
                      placeholder="e.g. UK Vastgoed introductory discount applied. (Always shown: ROCA Living is not VAT registered.)"
                    />
                  </div>
                </div>
                <div className="w-full md:w-72 flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-card-border pt-3 md:pt-0 md:pl-4">
                  <TotalRow label="Income" value={totals.income} />
                  <TotalRow label="ROCA fees (net)" value={-totals.fees} />
                  <TotalRow label="Other expenditure" value={-totals.other} />
                  <div className="flex justify-between border-t pt-2 mt-1 font-bold text-sm text-brand-primary">
                    <span>Payment to landlord:</span>
                    <span>{money(totals.payout)}</span>
                  </div>
                  {totals.closing < 0 && (
                    <span className="text-xs-portal font-semibold text-status-warning">
                      Costs exceed income — {money(totals.closing)} carries to the next statement.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" icon={Eye} onClick={preview} disabled={!form || previewing || saving || loadingForm || blocked}>
              {previewing ? 'Preparing...' : 'Preview PDF'}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || loadingForm || blocked}>
              {saving ? 'Generating...' : 'Generate Statement'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Warning = ({ text, danger = false }) => (
  <div className={`flex gap-3 items-start rounded-card p-4 border ${danger ? 'bg-status-danger-bg border-status-danger/15' : 'bg-status-warning/10 border-status-warning/15'}`}>
    <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${danger ? 'text-status-danger' : 'text-status-warning'}`} />
    <p className={`text-xs-portal font-semibold ${danger ? 'text-status-danger' : 'text-status-warning'}`}>{text}</p>
  </div>
);

const TotalRow = ({ label, value }) => (
  <div className="flex justify-between text-xs text-status-muted">
    <span>{label}:</span>
    <span>{money(value)}</span>
  </div>
);
