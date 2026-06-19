import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Home, Percent } from 'lucide-react';
import { Button } from '../components/UI/Button';

export const Reports = () => {
  const reports = [
    { name: 'YTD Collected Rent', value: '£348,450.00', icon: DollarSign, change: '+14% YTD growth', type: 'success' },
    { name: 'Average Management Fee Revenue', value: '£41,814.00', icon: TrendingUp, change: '12% average commission rate', type: 'success' },
    { name: 'Portfolio Occupancy Rate', value: '96.4%', icon: Home, change: '82 of 86 units currently occupied', type: 'success' },
    { name: 'Gross Yield Average', value: '6.8%', icon: Percent, change: '+0.4% from last quarter', type: 'info' },
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Reports Hub</h2>
          <p className="text-sm text-gray-500 mt-1">Analyze portfolio yields, fee incomes, occupancy trends, and business performance metrics.</p>
        </div>
        <Button variant="primary" icon={BarChart3} className="shadow-sm">
          Export Annual Financials
        </Button>
      </div>

      {/* Reports Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((rep, idx) => {
          const Icon = rep.icon;
          return (
            <div key={idx} className="bg-white border border-border-color/60 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{rep.name}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  rep.type === 'success' ? 'bg-status-success/10 text-status-success' : 'bg-brand-accent/10 text-brand-accent'
                }`}>
                  <Icon size={16} />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-[#1A1A1A]">{rep.value}</span>
                <p className="text-xs text-gray-400 mt-1.5 font-semibold">{rep.change}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
