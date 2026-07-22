import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from './Skeleton';
import api from '../../utilities/api';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Ledger transaction types grouped for charting. Colors mirror the chart tokens.
const INCOME_TYPES = ['rent_in'];
const FEE_TYPES = ['mgmt_fee', 'vat', 'agent_letting_fee', 'roca_letting_fee'];
const COST_TYPES = ['contractor_cost', 'deduction', 'nrl_withholding', 'other'];

const TYPE_LABELS = {
  rent_in: 'Rent Received',
  mgmt_fee: 'Management Fees',
  vat: 'VAT',
  agent_letting_fee: 'Agent Letting Fees',
  roca_letting_fee: 'ROCA Letting Fees',
  contractor_cost: 'Contractor Costs',
  nrl_withholding: 'NRL Withholding',
  landlord_payout: 'Landlord Payouts',
  deduction: 'Deductions',
  other: 'Other',
};

const DONUT_COLORS = ['#3A7D44', '#4F46E5', '#E8A020', '#F16900', '#0A58CA', '#C62828', '#7C3AED', '#6B7280'];

// 12-month cash-flow chart + income/outgoings breakdowns, fed by /reports/cashflow.
export const CashflowOverview = () => {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get('/reports/cashflow')
      .then((res) => setRows(res.data.data || []))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) {
    return <Skeleton radius="card" className="h-64 w-full" />;
  }
  if (rows.length === 0) {
    return null; // no ledger activity yet — keep the hub uncluttered
  }

  // Build one entry per month across the trailing 12 months
  const months = [...new Set(rows.map((r) => r.ym))].sort();
  const monthly = months.map((ym) => {
    const of = (types) => rows
      .filter((r) => r.ym === ym && types.includes(r.type))
      .reduce((s, r) => s + parseFloat(r.total), 0);
    const income = of(INCOME_TYPES);
    const fees = of(FEE_TYPES);
    const costs = of(COST_TYPES);
    const [y, m] = ym.split('-').map(Number);
    return {
      name: new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' }),
      Income: +income.toFixed(2),
      Fees: +fees.toFixed(2),
      Costs: +costs.toFixed(2),
    };
  });

  const totalByType = rows.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + parseFloat(r.total);
    return acc;
  }, {});
  const breakdown = (types) => types
    .map((t) => ({ name: TYPE_LABELS[t] || t, value: +(totalByType[t] || 0).toFixed(2) }))
    .filter((d) => d.value > 0);

  const incomeBreakdown = breakdown([...INCOME_TYPES, ...FEE_TYPES]);
  const outgoingBreakdown = breakdown([...COST_TYPES, 'landlord_payout']);

  const donut = (data, title) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-brand-primary">{title}</h4>
        {data.length === 0 ? (
          <p className="text-2xs text-gray-400 font-semibold py-4">No activity recorded.</p>
        ) : (
          <div className="flex items-center gap-4">
            <PieChart width={110} height={110}>
              <Pie data={data} dataKey="value" innerRadius={34} outerRadius={50} stroke="none" isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={d.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              {data.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-2xs font-semibold text-gray-400 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="text-2xs font-bold text-brand-primary tabular-nums shrink-0">
                    {money(d.value)}{total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Cash flow bar chart */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 xl:col-span-2 overflow-x-auto">
        <h3 className="text-sm-portal font-bold text-brand-primary border-b border-card-border pb-3 mb-4">
          Cash Flow (Last 12 Months)
        </h3>
        <BarChart width={720} height={240} data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={56}
            tickFormatter={(v) => `£${Number(v).toLocaleString('en-GB')}`} />
          <Tooltip formatter={(v, name) => [money(v), name]} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
          <Bar dataKey="Income" fill="#3A7D44" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Fees" fill="#4F46E5" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Costs" fill="#C62828" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </div>

      {/* Breakdowns */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-5 flex flex-col gap-5">
        <h3 className="text-sm-portal font-bold text-brand-primary border-b border-card-border pb-3">
          Breakdown (12 Months)
        </h3>
        {donut(incomeBreakdown, 'Income & Fees')}
        {donut(outgoingBreakdown, 'Outgoings & Payouts')}
      </div>
    </div>
  );
};
