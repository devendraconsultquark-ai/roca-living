import { Router } from 'express';
import {
  getEstateBuildings,
  getEstateProperties,
  getEstateProperty,
  getEstateLandlords,
  getEstateLandlord,
  setEstatePropertyManaged
} from '../controllers/estatesController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// ROCA Estates (rocaem) blocks, apartments and landlords — read-only, admin only.
// The one write, /managed, only changes Roca Living's own lettings record.
const estatesRouter = Router();

estatesRouter.use(protect('admin'), restrictTo('ADMIN'));

estatesRouter.get('/buildings', getEstateBuildings);
estatesRouter.get('/properties', getEstateProperties);
estatesRouter.get('/properties/:id', getEstateProperty);
estatesRouter.patch('/properties/:id/managed', setEstatePropertyManaged);
estatesRouter.get('/landlords', getEstateLandlords);
estatesRouter.get('/landlords/:id', getEstateLandlord);

export default estatesRouter;
