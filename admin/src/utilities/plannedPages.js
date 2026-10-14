// Pages from the approved admin design (RL_Admin_Portal Design.pdf) that we
// have no data or page for yet. Each shows a dummy-data copy of the design
// (pages/mock) under a "Dummy data" banner with links to what to use today.
// Routes (App.jsx) and page headers (AdminLayout HEADERS) read this list.
export const PLANNED_PAGES = [
  {
    slug: 'landlord-onboarding',
    title: 'Landlord Onboarding',
    subtitle: 'End-to-end onboarding workflow for landlords, properties and compliance.',
    related: [{ label: 'All Landlords', path: '/landlords', note: "KYC, NRL and Terms of Business are on each landlord's Settings tab." }],
  },
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
    slug: 'renewals',
    title: 'Renewals',
    subtitle: 'Tenancies coming up for renewal.',
    related: [{ label: 'Tenancies', path: '/tenancies', note: 'Use the "Ending soon" tab.' }],
  },
  {
    slug: 'payments-received',
    title: 'Payments Received',
    subtitle: 'Track and manage all rent and other payments received.',
    related: [
      { label: 'Accounting Overview', path: '/accounting', note: 'See the Incoming Payments tab.' },
      { label: 'Rent Cycle', path: '/rent-cycle' },
    ],
  },
  {
    slug: 'expenses',
    title: 'Expenses',
    subtitle: 'Track all expenses and supplier payments across properties.',
    related: [{ label: 'Properties', path: '/properties', note: "Expenses are recorded on each property's Expenses tab." }],
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
    slug: 'statements-payments',
    title: 'Statements & Payments',
    subtitle: 'Landlord statements and payments in one place.',
    related: [
      { label: 'Statements', path: '/statements', note: 'Generate, email and mark statements as paid.' },
      { label: 'Rent Cycle', path: '/rent-cycle', note: 'Approve rent, pay the landlord, make the statement.' },
    ],
  },
  {
    slug: 'tenancy-lifecycle',
    title: 'Tenancy Lifecycle',
    subtitle: 'Each tenancy from move-in to move-out.',
    related: [
      { label: 'Tenancies', path: '/tenancies' },
      { label: 'Calendar', path: '/calendar', note: 'Shows move-ins and move-outs.' },
      { label: 'Deposits', path: '/deposits' },
    ],
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
