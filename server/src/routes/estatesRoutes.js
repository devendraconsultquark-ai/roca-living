import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';
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
  deleteEstateApartment,
  uploadEstateApartmentFile,
  removeEstateApartmentFile,
  getEstateApartmentFile,
  acceptEstateOwner
} from '../controllers/estatesWriteController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

// ROCA Estates (rocaem) blocks, apartments and landlords, admin only. Reads
// come straight from its database; adds, edits and deletes of landlords and
// apartments go through ROCA Estates' own API (estatesWriteController).
// /managed only changes Roca Living's own lettings record.
const estatesRouter = Router();

// Apartment files (floor plan, certificates, lease…) go straight on to ROCA
// Estates, so they are held in memory here, never written to Roca Living's disk.
const FILE_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
const apartmentFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!FILE_EXTS.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new ApiError(400, 'Only PDF, image (JPG, PNG, WEBP) and Word files are allowed'), false);
    }
    cb(null, true);
  }
});

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
estatesRouter.post('/properties/:id/accept-owner', acceptEstateOwner);
estatesRouter.get('/properties/:id/files/:field', getEstateApartmentFile);
estatesRouter.put('/properties/:id/files/:field', apartmentFileUpload.single('file'), uploadEstateApartmentFile);
estatesRouter.delete('/properties/:id/files/:field', removeEstateApartmentFile);

export default estatesRouter;
