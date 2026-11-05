import api from './api';

// The landlord's statements — every kind (Roca Living, Rent Cycle, Historic) —
// from GET /all-statements/my, the same list the admin pages use. Each row also
// carries the older field names the portal screens read (gross_rent, net_paid,
// deductions, source_property_id…), so every figure comes from one place.
export const fetchMyStatements = async () => {
  const res = await api.get('/all-statements/my');
  return (res.data?.data?.rows || []).map((r) => ({
    ...r,
    id: r.key,
    historic: r.type === 'historic',
    statementNumber: r.statement_number,
    source: 'local',
    source_property_id: r.property_id,
    gross_rent: r.rent,
    net_paid: r.net,
    deductions: r.fees,
    nrl_withheld: 0,
    generated_at: r.issued_on,
    paid_at: r.paid_on,
  }));
};

// PDF of any statement kind (the key is rl-12 / ar-3 / h-5).
export const statementPdfUrl = (key) => `/all-statements/${key}/pdf`;
