import { useState, useEffect } from 'react';
import { TrendingUp, Users, Clock, Banknote, FileText, ScrollText } from 'lucide-react';
import { KpiRow, KpiCard } from './DesignKit';
import { gbp } from '../../utilities/designTokens';
import api from '../../utilities/api';

// Accounting Overview KPI row. Landlord money = every statement (Roca Living,
// Rent Cycle, Historic) whose period starts this year — the same figures as the
// Statements, landlord, property and portal pages. Plus outstanding invoices.
export const AccountingKpis = () => {
  const [totals, setTotals] = useState(null);
  const [invoices, setInvoices] = useState(null);

  useEffect(() => {
    api.get('/all-statements', { skipInterceptorError: true }).then((res) => setTotals(res.data.data?.totals_year || {})).catch(() => setTotals({}));
    api.get('/invoices', { skipInterceptorError: true }).then((res) => setInvoices(res.data.data || [])).catch(() => setInvoices([]));
  }, []);

  const year = String(new Date().getFullYear());
  const t = totals || {};
  const outstanding = (invoices || []).filter((i) => String(i.status).toLowerCase() === 'sent');
  const loading = totals === null;

  return (
    <KpiRow cols={6}>
      <KpiCard icon={TrendingUp} tone="green" label={`Rent On Statements (${year})`} value={gbp(t.rent || 0)} sub="All statements this year" link="View statements" to="/statements" loading={loading} />
      <KpiCard icon={Users} tone="indigo" label={`Fees & Costs (${year})`} value={gbp(t.fees || 0)} sub="Taken off the rent" link="View statements" to="/statements" loading={loading} />
      <KpiCard icon={Banknote} tone="blue" label={`Paid to Landlords (${year})`} value={gbp(t.paid_out || 0)} sub="Statements paid" link="View rent cycle" to="/rent-cycle" loading={loading} />
      <KpiCard icon={Clock} tone="orange" label="Waiting To Be Paid" value={gbp(t.pending_payout || 0)} sub={`${t.pending_count || 0} statement${t.pending_count === 1 ? '' : 's'}`} link="View rent cycle" to="/rent-cycle" loading={loading} />
      <KpiCard icon={ScrollText} tone="indigo" label={`Statements (${year})`} value={String(t.count || 0)} sub="Roca Living, Rent Cycle, Historic" link="View statements" to="/statements" loading={loading} />
      <KpiCard icon={FileText} tone="orange" label="Outstanding Invoices" value={gbp(outstanding.reduce((s, i) => s + parseFloat(i.net || 0), 0))} sub={`${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}`} link="View outstanding" to="/invoices" loading={invoices === null} />
    </KpiRow>
  );
};
