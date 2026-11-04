import { TENANCY_TYPE, reviewLabel, depositLabel, dueLabel } from './tenancyFacts';

export const formatProperty = (p, t = null, openTicketsCount = 0, netPaid = 0) => {
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
    tenancy_type: t ? TENANCY_TYPE : '-',
    start_date: t && t.start_date
      ? new Date(t.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-',
    tenancy_start_raw: t && t.start_date ? t.start_date : null,
    next_review: t ? reviewLabel(t) : '-',
    due_label: t ? dueLabel(t) : '-',
    deposit_amount: t && t.deposit_amount ? parseFloat(t.deposit_amount) : 0,
    deposit_status: t ? depositLabel(t) : '-',
    maintenance_issues: openTicketsCount,
    compliance_pct: compliancePct,
    net_paid: netPaid // payouts of this flat's statements marked paid
  };
};
