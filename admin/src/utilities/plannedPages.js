// Pages from the approved admin design (RL_Admin_Portal Design.pdf) that we
// have no data or page for yet. Each shows a dummy-data copy of the design
// (pages/mock) under a "Dummy data" banner with links to what to use today.
// Routes (App.jsx) and page headers (AdminLayout HEADERS) read this list.
export const PLANNED_PAGES = [
  {
    slug: 'landlord-groups',
    title: 'Landlord Groups',
    subtitle: 'Group landlords (families, companies) for combined portfolio views.',
    related: [{ label: 'All Landlords', path: '/landlords' }],
  },
  {
    slug: 'referral-partners',
    title: 'Referral Partners',
    subtitle: 'Partners who introduce landlords to ROCA Living.',
    related: [{ label: 'All Landlords', path: '/landlords' }],
  },
  {
    slug: 'management-packages',
    title: 'Management Packages',
    subtitle: 'Service packages and fees offered to landlords.',
    related: [{ label: 'Settings', path: '/settings', note: 'The management fee % is set under Financial Settings.' }],
  },
  {
    slug: 'bank-reconciliation',
    title: 'Bank Reconciliation',
    subtitle: 'Reconcile bank accounts and match management fees.',
    related: [{ label: 'Accounting Overview', path: '/accounting', note: 'Bank transactions from Xero are on the Bank Transactions tab.' }],
  },
  {
    slug: 'vat',
    title: 'VAT',
    subtitle: 'Track VAT liabilities, returns and payments.',
    related: [{ label: 'Settings', path: '/settings', note: 'VAT returns are filed from Xero.' }],
  },
  {
    slug: 'communications',
    title: 'Communications',
    subtitle: 'Messages to landlords and tenants.',
    related: [{ label: 'Statements', path: '/statements', note: 'Statement emails are sent from here.' }],
  },
];

// Not a page of its own: the Tenant Compliance tab on the Compliance page.
export const TENANT_COMPLIANCE = {
  related: [
    { label: 'Tenants', path: '/tenants', note: "Right to Rent is on each tenant's page." },
    { label: 'Deposits', path: '/deposits' },
  ],
};
