import { LandlordOnboardingMock } from './LandlordOnboardingMock';
import { LandlordGroupsMock } from './LandlordGroupsMock';
import { ReferralPartnersMock } from './ReferralPartnersMock';
import { ManagementPackagesMock } from './ManagementPackagesMock';
import { RenewalsMock } from './RenewalsMock';
import { PaymentsReceivedMock } from './PaymentsReceivedMock';
import { ExpensesMock } from './ExpensesMock';
import { BankReconciliationMock } from './BankReconciliationMock';
import { VatMock } from './VatMock';
import { StatementsPaymentsMock } from './StatementsPaymentsMock';
import { TenancyLifecycleMock } from './TenancyLifecycleMock';
import { CommunicationsMock } from './CommunicationsMock';

// Route slug (utilities/plannedPages.js) → dummy-data copy of the design page.
// Onboarding, Payments Received, Expenses, Bank Reconciliation and VAT copy
// design p3/p22/p23/p25/p26; the others have no design screen and follow its style.
export const MOCK_PAGES = {
  'landlord-onboarding': LandlordOnboardingMock,
  'landlord-groups': LandlordGroupsMock,
  'referral-partners': ReferralPartnersMock,
  'management-packages': ManagementPackagesMock,
  renewals: RenewalsMock,
  'payments-received': PaymentsReceivedMock,
  expenses: ExpensesMock,
  'bank-reconciliation': BankReconciliationMock,
  vat: VatMock,
  'statements-payments': StatementsPaymentsMock,
  'tenancy-lifecycle': TenancyLifecycleMock,
  communications: CommunicationsMock,
};
