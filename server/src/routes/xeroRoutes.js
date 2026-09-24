import { Router } from 'express';
import {
  getXeroStatus,
  startXeroConnect,
  xeroCallback,
  disconnectXero,
  getXeroBankAccounts
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

// Bank transactions (money in / out) → reconciled into ROCA
xeroRouter.get('/import-settings', getImportSettings);
xeroRouter.put('/import-settings', saveImportSettings);
xeroRouter.post('/sync', syncXero);
xeroRouter.get('/transactions', listBankTransactions);
xeroRouter.post('/transactions/:id/reconcile', reconcileBankTransaction);
xeroRouter.post('/transactions/:id/ignore', ignoreBankTransaction);
xeroRouter.post('/transactions/:id/undo', undoBankTransaction);

export default xeroRouter;
