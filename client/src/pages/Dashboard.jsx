import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, User, Calendar, CheckCircle2, AlertTriangle, XCircle, 
  Wrench, Clock, Check
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Button } from '../components/UI/Button';
import { StatusPill } from '../components/UI/StatusPill';
import api from '../utilities/api';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [latestStatement, setLatestStatement] = useState(null);
  const [activeTenancy, setActiveTenancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const stmtRes = await api.get('/statements/my');
        const latest = stmtRes.data.data && stmtRes.data.data.length > 0 ? stmtRes.data.data[0] : null;
        setLatestStatement(latest);

        const tenancyRes = await api.get('/tenancies/my');
        const active = tenancyRes.data.data && tenancyRes.data.data.length > 0 ? tenancyRes.data.data[0] : null;
        setActiveTenancy(active);

        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="py-6 flex flex-col gap-6 max-w-[1280px] mx-auto px-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-lg w-1/3" />
        <div className="h-4 bg-gray-50 rounded-lg w-1/4 mt-1" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="h-[320px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[200px] bg-gray-100/60 rounded-2xl" />
          </div>
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[220px] bg-gray-100/60 rounded-2xl" />
              <div className="h-[220px] bg-gray-100/60 rounded-2xl" />
            </div>
            <div className="h-[140px] bg-gray-100/60 rounded-2xl" />
            <div className="h-[140px] bg-gray-100/60 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Derive values from statement & tenancy
  const rentReceived = latestStatement ? parseFloat(latestStatement.gross_rent || 0) : 0.0;
  const netIncome = latestStatement ? parseFloat(latestStatement.net_paid || 0) : 0.0;
  const totalFees = latestStatement 
    ? parseFloat(latestStatement.mgmt_fee || 0) + 
      parseFloat(latestStatement.mgmt_fee_vat || 0) + 
      parseFloat(latestStatement.roca_letting_fee || 0) + 
      parseFloat(latestStatement.agent_letting_fee || 0)
    : 0.0;
  const deductions = latestStatement ? parseFloat(latestStatement.deductions || 0) + parseFloat(latestStatement.nrl_withheld || 0) : 0.0;
  const expenditure = totalFees + deductions;

  const hasActiveTenancy = !!activeTenancy;
  const occupancyPct = hasActiveTenancy ? '100%' : '0%';
  const occupancyLabel = hasActiveTenancy ? 'Occupied' : 'Vacant';
  
  const outerValue = rentReceived > 0 ? rentReceived : 0.01;
  const innerValue = hasActiveTenancy ? 100 : 0.01;

  // Donut Chart data matching state
  const outerData = [
    { name: 'Rent Received', value: outerValue, color: '#3A7D44' }
  ];
  const innerData = [
    { name: 'Occupied', value: innerValue, color: '#E8A020' }
  ];

  // Arrears calculations
  const rentPcm = activeTenancy ? parseFloat(activeTenancy.rent_pcm || 0) : 0.0;
  // If rent pcm > rent received on latest statement, show arrears
  const rentArrears = hasActiveTenancy ? Math.max(0, rentPcm - rentReceived) : 0.0;
  const daysInArrears = rentArrears > 0 ? 15 : 0;
  const arrearsStatus = rentArrears > 0 ? 'arrears' : 'compliant';
  const customArrearsLabel = rentArrears > 0 ? 'Payment Overdue' : 'Up to Date';

  // §12.3 Accessibility: disable chart animation when user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1280px] mx-auto px-4 font-sans text-[#1A1A1A]">
      
      {/* 1. Welcome Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Landlord Partner Dashboard</h2>
        <p className="text-xs text-gray-500 mt-0.5">Overview of your properties, compliance checklist, and statement payouts.</p>
      </div>

      {error && (
        <div className="border border-status-danger bg-status-danger/5 rounded-xl p-4 text-center text-status-danger font-semibold">
          {error}
        </div>
      )}

      {/* 3. Main Dashboard Layout (2 Columns: Donut Chart [40%] + Widgets [60%]) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Column (40% width on lg screens) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Performance Summary Card with Donut Chart */}
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col gap-4 shadow-xs">
            <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none">Performance Summary</h3>
            
            {/* PieChart Container */}
            <div className="w-full flex flex-col items-center justify-center py-4">
              <div className="w-[180px] h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* Outer Ring - Rent Received */}
                    <Pie
                      data={outerData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive={!prefersReducedMotion}
                    >
                      <Cell fill="#3A7D44" />
                    </Pie>
                    {/* Inner Ring - Occupancy */}
                    <Pie
                      data={innerData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={58}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive={!prefersReducedMotion}
                    >
                      <Cell fill="#E8A020" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Percentage Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                  <span className="text-xl font-bold text-[#1A1A1A] leading-none">{occupancyPct}</span>
                  <span className="text-[10px] text-gray-400 font-semibold mt-0.5">{occupancyLabel}</span>
                </div>
              </div>

              {/* Legend Below Chart */}
              <div className="mt-6 flex flex-col gap-2 w-full max-w-[240px] text-[10px] font-semibold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3A7D44] inline-block shrink-0"></span>
                    <span className="text-gray-500">Rent Received</span>
                  </div>
                  <span className="text-gray-800 font-mono">£{rentReceived.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] inline-block shrink-0"></span>
                    <span className="text-gray-500">Expenditure</span>
                  </div>
                  <span className="text-gray-800 font-mono">£{expenditure.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* NET INCOME banner */}
            <div className="border-t border-[#DDDDDD] pt-3 flex justify-between items-center mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Net Income (This Period)</span>
                {!latestStatement && (
                  <span className="text-[9px] text-status-warning font-semibold">No statements generated yet</span>
                )}
              </div>
              <span className="text-lg font-bold text-[#E8A020] font-mono">£{netIncome.toFixed(2)}</span>
            </div>
          </div>

          {/* Arrears Summary Card */}
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none">Arrears Summary</h3>
            
            <div className="flex flex-col gap-2 text-[10px]">
              <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/60">
                <span className="text-gray-500">Total Rent Due</span>
                <span className="font-bold font-mono">£{rentPcm.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/60">
                <span className="text-gray-500">Total Rent Received</span>
                <span className="font-bold font-mono text-[#3A7D44]">£{rentReceived.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/60">
                <span className="text-gray-500 font-bold">Rent Arrears</span>
                <span className={`font-bold font-mono ${rentArrears > 0 ? 'text-status-danger' : 'text-gray-400'}`}>£{rentArrears.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/60">
                <span className="text-gray-500">Days in Arrears</span>
                <span className="font-bold font-mono">{daysInArrears} days</span>
              </div>
              <div className="flex justify-between items-center py-1 mt-1">
                <span className="text-gray-500 font-bold">Arrears Status</span>
                <StatusPill status={arrearsStatus} customLabel={customArrearsLabel} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (60% width on lg screens) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Top Widgets Horizontal Layout Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Compliance Status Checklist Card */}
            <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none border-b border-[#DDDDDD] pb-2">Compliance Status</h3>
              
              <div className="flex flex-col gap-2">
                {/* EPC */}
                <div className="flex items-center justify-between text-[10px] py-1 border-b border-[#DDDDDD]/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>EPC Rating: C</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">Valid until 12/08/2029</span>
                </div>
                {/* EICR */}
                <div className="flex items-center justify-between text-[10px] py-1 border-b border-[#DDDDDD]/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>EICR Electrical</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">Valid until 15/05/2031</span>
                </div>
                {/* Gas Safety */}
                <div className="flex items-center justify-between text-[10px] py-1 border-b border-[#DDDDDD]/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>Gas Safety Certificate</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">Valid until 28/05/2027</span>
                </div>
                {/* Deposit */}
                <div className="flex items-center justify-between text-[10px] py-1 border-b border-[#DDDDDD]/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>Deposit Protection</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">
                    {activeTenancy?.deposit_scheme ? `Registered (${activeTenancy.deposit_scheme})` : 'Registered'}
                  </span>
                </div>
                {/* Right to Rent */}
                <div className="flex items-center justify-between text-[10px] py-1 border-b border-[#DDDDDD]/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>Right to Rent Check</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">Verified (AST)</span>
                </div>
                {/* Landlord ID/KYC */}
                <div className="flex items-center justify-between text-[10px] py-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 size={14} className="text-[#2E7D32] shrink-0" />
                    <span>Landlord ID & KYC</span>
                  </div>
                  <span className="text-[9px] text-gray-400 font-semibold">Verified</span>
                </div>
              </div>
            </div>

            {/* Key Dates Card */}
            <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs">
              <div>
                <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none border-b border-[#DDDDDD] pb-2">Key Dates</h3>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center text-[10px] py-1">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                      <Calendar size={14} className="text-[#E8A020]" />
                      <span>Next Inspection</span>
                    </div>
                    <span className="font-bold font-mono">18/09/2026</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] py-1">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                      <Calendar size={14} className="text-[#E8A020]" />
                      <span>Next Rent Review</span>
                    </div>
                    <span className="font-bold font-mono">01/01/2027</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] py-1">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                      <Calendar size={14} className="text-[#E8A020]" />
                      <span>Tenancy Anniversary</span>
                    </div>
                    <span className="font-bold font-mono">
                      {activeTenancy?.start_date ? new Date(activeTenancy.start_date).toLocaleDateString('en-GB') : '12/06/2027'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] py-1">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                      <Calendar size={14} className="text-[#E8A020]" />
                      <span>Gas Safety Renewal</span>
                    </div>
                    <span className="font-bold font-mono text-[#E0A93B]">28/05/2027</span>
                  </div>
                  {/* Next EICR Due */}
                  <div className="flex justify-between items-center text-[10px] py-1">
                    <div className="flex items-center gap-1.5 font-semibold text-gray-600">
                      <Calendar size={14} className="text-[#E8A020]" />
                      <span>Next EICR Due</span>
                    </div>
                    <span className="font-bold font-mono">15/05/2031</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="primary" 
                size="sm" 
                fullWidth
                onClick={() => navigate('/inspections')}
              >
                View All Dates
              </Button>
            </div>

          </div>

          {/* Tenancy Summary Card */}
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none border-b border-[#DDDDDD] pb-2">Tenancy Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/40">
                  <span className="text-gray-500">Tenant Name</span>
                  <span className="font-bold text-gray-800">{activeTenancy?.lead_tenant_name || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/40">
                  <span className="text-gray-500">Agreement Type</span>
                  <span className="font-bold">AST (Fully Managed)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Tenancy Start Date</span>
                  <span className="font-bold font-mono">
                    {activeTenancy?.start_date ? new Date(activeTenancy.start_date).toLocaleDateString('en-GB') : '-'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/40">
                  <span className="text-gray-500">Monthly Rent</span>
                  <span className="font-bold font-mono">
                    {activeTenancy?.rent_pcm ? `£${parseFloat(activeTenancy.rent_pcm).toFixed(2)}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#DDDDDD]/40">
                  <span className="text-gray-500">
                    {activeTenancy?.deposit_scheme ? `Deposit Held (${activeTenancy.deposit_scheme})` : 'Deposit Held'}
                  </span>
                  <span className="font-bold font-mono">
                    {activeTenancy?.deposit_amount ? `£${parseFloat(activeTenancy.deposit_amount).toFixed(2)}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Next Review Date</span>
                  <span className="font-bold font-mono">
                    {activeTenancy?.end_date ? new Date(activeTenancy.end_date).toLocaleDateString('en-GB') : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Overview Widget */}
          <div className="bg-white border border-[#DDDDDD] rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <h3 className="font-bold text-[10px] text-[#1A1A1A] uppercase tracking-wider select-none border-b border-[#DDDDDD] pb-2">Maintenance Overview</h3>
            
            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-4 text-center mt-1">
              <div className="flex flex-col items-center justify-center p-2 bg-[#F2F2F2]/60 rounded-xl border border-[#DDDDDD]/60">
                <Wrench size={16} className="text-gray-500 mb-1" />
                <span className="text-[18px] font-bold text-gray-800 font-mono leading-none">1</span>
                <span className="text-[9px] font-semibold text-gray-500 mt-1 uppercase">Open Issues</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-[#F2F2F2]/60 rounded-xl border border-[#DDDDDD]/60">
                <Clock size={16} className="text-gray-500 mb-1" />
                <span className="text-[18px] font-bold text-gray-800 font-mono leading-none">1</span>
                <span className="text-[9px] font-semibold text-gray-500 mt-1 uppercase">In Progress</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-[#F2F2F2]/60 rounded-xl border border-[#DDDDDD]/60">
                <Check size={16} className="text-[#2E7D32] mb-1" />
                <span className="text-[18px] font-bold text-gray-800 font-mono leading-none">3</span>
                <span className="text-[9px] font-semibold text-gray-500 mt-1 uppercase">Completed</span>
              </div>
            </div>

            {/* spend tags */}
            <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-gray-400 mt-2 select-none justify-center md:justify-start">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                Spend This Period: <span className="font-mono text-gray-500">£0.00</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                Spend YTD: <span className="font-mono text-gray-500">£0.00</span>
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
