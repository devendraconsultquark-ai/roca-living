import { useState, useEffect } from 'react';
import { TrendingUp, Users, Briefcase, ArrowDownCircle, Banknote, FileText } from 'lucide-react';
import { KpiRow, KpiCard } from './DesignKit';
import { gbp } from '../../utilities/designTokens';
import api from '../../utilities/api';

// Design p20 (Accounting Overview) KPI row, from the transactions ledger this
// calendar year (same source as the cash-flow chart) and the invoices list.
const YTD_TYPES = {
  rent: ['rent_in'],
  fees: ['mgmt_fee'],
  letting: ['roca_letting_fee', 'agent_letting_fee'],
  costs: ['contractor_cost', 'deduction', 'other'],
  payouts: ['landlord_payout'],
};

export const AccountingKpis = () => {
  const [rows, setRows] = useState(null);
  const [invoices, setInvoices] = useState(null);

  useEffect(() => {
    api.get('/reports/cashflow', { skipInterceptorError: true }).then((res) => setRows(res.data.data || [])).catch(() => setRows([]));
    api.get('/invoices', { skipInterceptorError: true }).then((res) => setInvoices(res.data.data || [])).catch(() => setInvoices([]));
  }, []);

  const year = String(new Date().getFullYear());
  const ytd = (types) => (rows || [])
    .filter((r) => String(r.ym).startsWith(year) && types.includes(r.type))
    .reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const outstanding = (invoices || []).filter((i) => String(i.status).toLowerCase() === 'sent');
  const loading = rows === null;

  return (
    <KpiRow cols={6}>
      <KpiCard icon={TrendingUp} tone="green" label={`Total Rent Received (${year})`} value={gbp(ytd(YTD_TYPES.rent))} sub="From the ledger" link="View rent cycle" to="/rent-cycle" loading={loading} />
      <KpiCard icon={Users} tone="indigo" label={`Management Fees (${year})`} value={gbp(ytd(YTD_TYPES.fees))} sub="Charged on statements" link="View statements" to="/statements" loading={loading} />
      <KpiCard icon={Briefcase} tone="orange" label={`Letting Fees (${year})`} value={gbp(ytd(YTD_TYPES.letting))} sub="ROCA and agent letting fees" loading={loading} />
      <KpiCard icon={ArrowDownCircle} tone="red" label={`Costs & Deductions (${year})`} value={gbp(ytd(YTD_TYPES.costs))} sub="Contractors, deductions, other" link="View expenses" to="/properties" loading={loading} />
      <KpiCard icon={Banknote} tone="blue" label={`Paid to Landlords (${year})`} value={gbp(ytd(YTD_TYPES.payouts))} sub="Landlord payouts" link="View payouts" to="/rent-cycle" loading={loading} />
      <KpiCard icon={FileText} tone="orange" label="Outstanding Invoices" value={gbp(outstanding.reduce((s, i) => s + parseFloat(i.net || 0), 0))} sub={`${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}`} link="View outstanding" to="/invoices" loading={invoices === null} />
    </KpiRow>
  );
};
