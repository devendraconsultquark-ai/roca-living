export const formatProperty = (p, t = null, openTicketsCount = 0) => {
  const address = `${p.address_line1}${p.address_line2 ? `, ${p.address_line2}` : ''}, ${p.city} ${p.postcode}`;
  
  // Compliance calculation: percentage of compliant certs among Gas, EPC, EICR
  const certStatuses = [p.gasCompliance, p.epcCompliance, p.eicrCompliance];
  const compliantCount = certStatuses.filter(s => s === 'compliant').length;
  const compliancePct = certStatuses.length > 0 
    ? Math.round((compliantCount / certStatuses.length) * 100) 
    : 100;

  return {
    ...p,
    address,
    tenant: t ? t.lead_tenant_name : '-',
    rent: p.rent_pcm ? parseFloat(p.rent_pcm) : 0,
    status: p.status,

    // API joined tenancy/compliance details (replaces hardcoded Parsons/Random Street mocks)
    tenant_name: t ? t.lead_tenant_name : '-',
    tenancy_type: t ? 'Assured Shorthold Tenancy' : '-',
    start_date: t && t.start_date 
      ? new Date(t.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : '-',
    next_review: '-', // TODO: backend needs to return next rent review date
    deposit_amount: t && t.deposit_amount ? parseFloat(t.deposit_amount) : 0,
    deposit_status: t ? 'Protected' : '-',
    maintenance_issues: openTicketsCount,
    compliance_pct: compliancePct,
    net_paid: 0 // TODO: backend needs to return net paid payout totals per property
  };
};
