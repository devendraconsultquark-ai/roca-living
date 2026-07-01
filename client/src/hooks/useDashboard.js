import { useState, useEffect } from 'react';
import api from '../utilities/api';

export const useDashboard = () => {
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

  // Derive calculations from statement & tenancy
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

  const outerData = [
    { name: 'Rent Received', value: outerValue, color: '#3A7D44' }
  ];
  const innerData = [
    { name: 'Occupied', value: innerValue, color: '#E8A020' }
  ];

  const rentPcm = activeTenancy ? parseFloat(activeTenancy.rent_pcm || 0) : 0.0;
  const rentArrears = hasActiveTenancy ? Math.max(0, rentPcm - rentReceived) : 0.0;
  const daysInArrears = rentArrears > 0 ? 15 : 0;
  const arrearsStatus = rentArrears > 0 ? 'arrears' : 'compliant';
  const customArrearsLabel = rentArrears > 0 ? 'Payment Overdue' : 'Up to Date';

  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  return {
    latestStatement,
    activeTenancy,
    loading,
    error,
    rentReceived,
    netIncome,
    totalFees,
    deductions,
    expenditure,
    hasActiveTenancy,
    occupancyPct,
    occupancyLabel,
    outerData,
    innerData,
    rentPcm,
    rentArrears,
    daysInArrears,
    arrearsStatus,
    customArrearsLabel,
    prefersReducedMotion,
  };
};
