import { Router } from 'express';
import {
  getXeroStatus,
  startXeroConnect,
  xeroCallback,
  disconnectXero,
  getXeroBankAccounts,
  getXeroOrganisations,
  chooseXeroOrganisation,
  getXeroAccounts,
  getXeroAccountSettings,
  saveXeroAccountSettings,
  getXeroDiagnostics,
  pushXeroRentInvoices,
  getXeroRentInvoiceSettings,
  saveXeroRentInvoiceSettings
} from '../controllers/xeroController.js';
import {
  getImportSettings,
  saveImportSettings,
  syncXero,
  listBankTransactions,
  reconcileBankTransaction,
  ignoreBankTransaction,
  undoBankTransaction
} from '../controllers/xeroBankController.js';
import { listRentApprovals, approveRentPayment, changeRentSplit, pullRentPayments, sendRentToXero, sendAllRentToXero, undoSendRentToXero } from '../controllers/rentApprovalController.js';
import { getRentCycle, refreshRentCycle, approveAndSend } from '../controllers/rentCycleController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const xeroRouter = Router();

// Every route is admin-only. /connect and /callback are reached by top-level
// browser navigation (not XHR); the admin session cookie is SameSite=Lax, so it
// still accompanies the redirect back from Xero.
xeroRouter.use(protect('admin'), restrictTo('ADMIN'));

xeroRouter.get('/status', getXeroStatus);
xeroRouter.get('/connect', startXeroConnect);
xeroRouter.get('/callback', xeroCallback);
xeroRouter.get('/bank-accounts', getXeroBankAccounts);
xeroRouter.delete('/disconnect', disconnectXero);
xeroRouter.get('/organisations', getXeroOrganisations);
xeroRouter.put('/organisation', chooseXeroOrganisation);
xeroRouter.get('/accounts', getXeroAccounts);
xeroRouter.get('/account-settings', getXeroAccountSettings);
xeroRouter.put('/account-settings', saveXeroAccountSettings);
xeroRouter.get('/diagnostics', getXeroDiagnostics);
xeroRouter.post('/rent-invoices/push', pushXeroRentInvoices);
xeroRouter.get('/rent-invoices/settings', getXeroRentInvoiceSettings);
xeroRouter.put('/rent-invoices/settings', saveXeroRentInvoiceSettings);
xeroRouter.post('/rent-invoices/pull-payments', pullRentPayments);
xeroRouter.get('/rent-approvals', listRentApprovals);
xeroRouter.post('/rent-approvals/:id/approve', approveRentPayment);
xeroRouter.patch('/rent-approvals/:id/split', changeRentSplit);
xeroRouter.post('/rent-approvals/send-all', sendAllRentToXero);
xeroRouter.post('/rent-approvals/:id/send-to-xero', sendRentToXero);
xeroRouter.post('/rent-approvals/:id/undo-send', undoSendRentToXero);
// Rent Cycle page (the whole monthly flow in one place)
xeroRouter.get('/rent-cycle', getRentCycle);
xeroRouter.post('/rent-cycle/refresh', refreshRentCycle);
xeroRouter.post('/rent-cycle/approve', approveAndSend);

// Bank transactions (money in / out) → reconciled into ROCA
xeroRouter.get('/import-settings', getImportSettings);
xeroRouter.put('/import-settings', saveImportSettings);
xeroRouter.post('/sync', syncXero);
xeroRouter.get('/transactions', listBankTransactions);
xeroRouter.post('/transactions/:id/reconcile', reconcileBankTransaction);
xeroRouter.post('/transactions/:id/ignore', ignoreBankTransaction);
xeroRouter.post('/transactions/:id/undo', undoBankTransaction);

export default xeroRouter;
