import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { getFolders, uploadDocument, deleteDocument } from '../controllers/documentController.js';
import { protect } from '../middlewares/protect.js';
import { restrictTo } from '../middlewares/restrictTo.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const documentRouter = Router();

// Secure all routes
documentRouter.use(protect('admin'), restrictTo('ADMIN'));

documentRouter.get('/folders', getFolders);
documentRouter.post('/upload', upload.single('file'), uploadDocument);
documentRouter.delete('/:id', deleteDocument);

export default documentRouter;
