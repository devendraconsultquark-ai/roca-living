import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Receipt, Paperclip, Download } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { Skeleton } from './Skeleton';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

const money = (v) => `£${(parseFloat(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emptyForm = () => ({ expense_date: todayYmd(), description: '', supplier: '', amount: '' });

// Costs paid for an apartment during the month (cleaning, small repairs…).
// They are deducted on the landlord's statement for that month, then locked.
export const PropertyExpenses = ({ propertyId }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const fileInput = useRef(null);
  const attachInput = useRef(null);
  const [attachFor, setAttachFor] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/properties/${propertyId}/expenses`);
        setItems(res.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load expenses', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [propertyId, addToast, reloadKey]);

  const add = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.expense_date) errs.date = 'Enter the date';
    if (!form.description.trim()) errs.description = 'Enter a description';
    if (!(parseFloat(form.amount) > 0)) errs.amount = 'Enter an amount';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries({ ...form, amount: parseFloat(form.amount) }).forEach(([k, v]) => body.append(k, v));
      if (invoiceFile) body.append('invoice', invoiceFile);
      await api.post(`/properties/${propertyId}/expenses`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      addToast('Expense added — it will be deducted on the next statement', 'success');
      setForm(emptyForm());
      setInvoiceFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: 'Delete expense',
      message: `Delete "${item.description}" (${money(item.amount)})?`,
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/properties/${propertyId}/expenses/${item.id}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete expense', 'error');
    }
  };

  // Attach (or replace) the supplier invoice on an existing expense.
  const attach = async (file) => {
    if (!file || !attachFor) return;
    const body = new FormData();
    body.append('invoice', file);
    try {
      await api.post(`/properties/${propertyId}/expenses/${attachFor}/invoice`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      addToast('Invoice attached', 'success');
      setReloadKey((k) => k + 1);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to attach invoice', 'error');
    } finally {
      setAttachFor(null);
      if (attachInput.current) attachInput.current.value = '';
    }
  };

  const downloadInvoice = async (item) => {
    try {
      const res = await api.get(`/properties/${propertyId}/expenses/${item.id}/invoice`, { responseType: 'blob', skipInterceptorError: true });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.invoice_name || `invoice-${item.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast('Failed to download the invoice', 'error');
    }
  };

  const pending = items.filter((i) => !i.statement_id).reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5">
        <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider mb-1">Add expense</h3>
        <p className="text-xs-portal text-status-muted mb-4">
          Money spent on this apartment (e.g. cleaning). It is deducted from the rent on the landlord's statement for that month.
        </p>
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_130px_auto] gap-3 items-end">
          <DatePicker label="Date" id="expenseDate" value={form.expense_date} onChange={(v) => setForm((f) => ({ ...f, expense_date: v }))} error={errors.date} />
          <Input id="expenseDescription" label="Description" placeholder="e.g. End of tenancy cleaning" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} error={errors.description} />
          <Input id="expenseSupplier" label="Supplier (optional)" placeholder="e.g. Sparkle Cleaners" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
          <Input id="expenseAmount" label="Amount (£)" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} error={errors.amount} />
          <Button type="submit" variant="primary" icon={Plus} disabled={saving}>{saving ? 'Adding…' : 'Add'}</Button>
          <div className="md:col-span-5">
            <label htmlFor="expenseInvoice" className="block text-xs font-semibold text-status-muted mb-1">Supplier invoice (PDF, JPG or PNG — recommended)</label>
            <input
              id="expenseInvoice"
              ref={fileInput}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
          </div>
        </form>
        <input ref={attachInput} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider">Expenses</h3>
          <span className="text-xs-portal text-status-muted">Not yet deducted: <strong className="text-brand-primary">{money(pending)}</strong></span>
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-status-muted py-4"><Receipt size={16} /> No expenses recorded for this apartment.</div>
        ) : (
          <div className="flex flex-col divide-y divide-card-border">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-semibold text-brand-primary">{i.description}{i.supplier ? ` – ${i.supplier}` : ''}</span>
                  <span className="text-xs-portal text-status-muted">{ukDate(i.expense_date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {i.has_invoice ? (
                    <button type="button" onClick={() => downloadInvoice(i)} className="flex items-center gap-1 text-xs-portal font-semibold text-status-info hover:underline cursor-pointer">
                      <Download size={13} /> Invoice
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setAttachFor(i.id); attachInput.current?.click(); }} className="flex items-center gap-1 text-xs-portal font-semibold text-status-warning hover:underline cursor-pointer">
                      <Paperclip size={13} /> Attach invoice
                    </button>
                  )}
                  <span className="font-bold">{money(i.amount)}</span>
                  {i.statement_id ? (
                    <span className="text-xs-portal text-status-success font-semibold">On {i.statement_number || 'statement'}</span>
                  ) : (
                    <>
                      <span className="text-xs-portal text-status-warning font-semibold">Next statement</span>
                      <button type="button" onClick={() => remove(i)} className="p-1.5 text-gray-400 hover:text-status-danger cursor-pointer" aria-label="Delete expense">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
