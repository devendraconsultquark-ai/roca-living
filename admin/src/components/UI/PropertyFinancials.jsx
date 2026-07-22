import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Skeleton } from './Skeleton';
import { Card } from './DetailComponents';
import api from '../../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const TYPE_LABELS = {
  rent_in: 'Rent Received',
  mgmt_fee: 'Management Fee',
  vat: 'VAT',
  agent_letting_fee: 'Agent Letting Fee',
  roca_letting_fee: 'ROCA Letting Fee',
  contractor_cost: 'Contractor Cost',
  nrl_withholding: 'NRL Withholding',
  landlord_payout: 'Landlord Payout',
  deduction: 'Deduction',
  other: 'Other',
};
const INCOME_TYPES = ['rent_in'];
const COST_TYPES = ['mgmt_fee', 'vat', 'agent_letting_fee', 'roca_letting_fee', 'contractor_cost', 'deduction', 'nrl_withholding', 'other'];

// Per-property financials tab: YTD summary + monthly chart + transaction list,
// all from the existing transactions ledger filtered by property.
export const PropertyFinancials = ({ propertyId }) => {
  const [transactions, setTransactions] = useState(null);

  useEffect(() => {
    api.get('/transactions', { params: { property_id: propertyId } })
      .then((res) => setTransactions(res.data.data || []))
      .catch(() => setTransactions([]));
  }, [propertyId]);

  if (transactions === null) {
    return <Skeleton radius="card" className="h-64 w-full" />;
  }

  const year = new Date().getFullYear();
  const ytd = transactions.filter((t) => t.transaction_date && new Date(t.transaction_date).getFullYear() === year);
  const sumOf = (list, types) => list
    .filter((t) => types.includes(t.type))
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const rentYtd = sumOf(ytd, INCOME_TYPES);
  const costsYtd = sumOf(ytd, COST_TYPES);
  const payoutsYtd = sumOf(ytd, ['landlord_payout']);
  const netYtd = rentYtd - costsYtd;

  // Trailing 12-month income vs costs
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = transactions.filter((t) => (t.transaction_date || '').startsWith(ym));
    return {
      name: d.toLocaleDateString('en-GB', { month: 'short' }),
      Income: +sumOf(inMonth, INCOME_TYPES).toFixed(2),
      Costs: +sumOf(inMonth, COST_TYPES).toFixed(2),
    };
  });
  const hasChartData = monthly.some((m) => m.Income > 0 || m.Costs > 0);

  const summary = [
    { label: `Rent Received (${year})`, value: money(rentYtd), cls: 'text-status-success' },
    { label: `Fees & Costs (${year})`, value: money(costsYtd), cls: 'text-status-danger' },
    { label: `Net (${year})`, value: money(netYtd), cls: netYtd >= 0 ? 'text-status-success' : 'text-status-danger' },
    { label: `Paid to Landlord (${year})`, value: money(payoutsYtd), cls: 'text-brand-primary' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* YTD summary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {summary.map((s) => (
          <div key={s.label} className="card-bg border border-card-border rounded-card shadow-premium p-4">
            <p className="text-2xs text-gray-400 font-semibold">{s.label}</p>
            <p className={`text-lg font-bold mt-1.5 tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <Card title="Income vs Costs (12 Months)">
          {hasChartData ? (
            <div className="overflow-x-auto">
              <BarChart width={520} height={220} data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={(v) => `£${Number(v).toLocaleString('en-GB')}`} />
                <Tooltip formatter={(v, name) => [money(v), name]} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                <Bar dataKey="Income" fill="#3A7D44" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Costs" fill="#C62828" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </div>
          ) : (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">No ledger activity in the last 12 months.</p>
          )}
        </Card>

        {/* Transactions */}
        <Card title={`Transactions (${transactions.length})`}>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-400 font-semibold py-8 text-center">
              No transactions recorded for this property yet.
            </p>
          ) : (
            <div className="overflow-y-auto max-h-80">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Date</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Type</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Description</th>
                    <th className="text-2xs font-bold text-gray-400 uppercase tracking-wider pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const isIncome = t.type === 'rent_in';
                    return (
                      <tr key={t.id} className="border-t border-card-border/60">
                        <td className="py-2 pr-3 text-2xs font-semibold text-gray-400 whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                        <td className="py-2 pr-3 text-2xs font-bold text-brand-primary whitespace-nowrap">{TYPE_LABELS[t.type] || t.type}</td>
                        <td className="py-2 pr-3 text-2xs font-semibold text-gray-400 truncate max-w-44">{t.description || '—'}</td>
                        <td className={`py-2 text-2xs font-bold text-right tabular-nums whitespace-nowrap ${isIncome ? 'text-status-success' : 'text-status-danger'}`}>
                          {isIncome ? '+' : '−'}{money(t.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
