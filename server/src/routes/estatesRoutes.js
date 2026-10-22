import { Router } from 'express';
import {
  getEstateBuildings,
  getEstateProperties,
  getEstateProperty,
  getEstateLandlords,
  getEstateLandlord,
  setEstatePropertyManaged
} from '../controllers/estatesController.js';
import {
  getEstatesEditStatus,
  createEstateLandlord,
  updateEstateLandlord,
  deleteEstateLandlord,
  createEstateApartment,
  updateEstateApartment,
  deleteEstateApartment
} from '../controllers/estatesWriteController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// ROCA Estates (rocaem) blocks, apartments and landlords, admin only. Reads
// come straight from its database; adds, edits and deletes of landlords and
// apartments go through ROCA Estates' own API (estatesWriteController).
// /managed only changes Roca Living's own lettings record.
const estatesRouter = Router();

estatesRouter.use(protect('admin'), restrictTo('ADMIN'));

estatesRouter.get('/buildings', getEstateBuildings);
estatesRouter.get('/properties', getEstateProperties);
estatesRouter.get('/properties/:id', getEstateProperty);
estatesRouter.patch('/properties/:id/managed', setEstatePropertyManaged);
estatesRouter.get('/landlords', getEstateLandlords);
estatesRouter.get('/landlords/:id', getEstateLandlord);

estatesRouter.get('/edit-status', getEstatesEditStatus);
estatesRouter.post('/landlords', createEstateLandlord);
estatesRouter.patch('/landlords/:id', updateEstateLandlord);
estatesRouter.delete('/landlords/:id', deleteEstateLandlord);
estatesRouter.post('/properties', createEstateApartment);
estatesRouter.patch('/properties/:id', updateEstateApartment);
estatesRouter.delete('/properties/:id', deleteEstateApartment);

export default estatesRouter;
