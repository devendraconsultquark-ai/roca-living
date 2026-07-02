import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const parseEntityId = (idStr) => {
  if (!idStr) return null;
  const match = idStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : parseInt(idStr, 10);
};

export const getFolders = catchAsync(async (req, res, next) => {
  // Ensure default folders exist
  let foldersList = await db('folders').select('*');
  if (foldersList.length === 0) {
    const defaultFolders = [
      { name: 'Landlord Compliance Documents', owner_type: 'global' },
      { name: 'Property Gas & Safety Certs', owner_type: 'global' },
      { name: 'Tenancy Agreements & Deposits', owner_type: 'global' }
    ];
    for (const f of defaultFolders) {
      await db('folders').insert(f);
    }
    foldersList = await db('folders').select('*');
  }

  const documents = await db('documents').select('*');
  const properties = await db('properties').select('id', 'property_reference');
  const landlords = await db('users')
    .join('landlord_profiles', 'users.id', 'landlord_profiles.user_id')
    .select('users.id', 'landlord_profiles.landlord_reference');

  const propRefMap = Object.fromEntries(properties.map(p => [p.id, p.property_reference]));
  const landRefMap = Object.fromEntries(landlords.map(l => [l.id, l.landlord_reference]));

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.log(bytes) / Math.log(k) ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const responseData = foldersList.map(folder => {
    // Filter documents in this folder
    const folderDocs = documents.filter(d => d.folder_id === folder.id);

    return {
      id: folder.id,
      name: folder.name,
      isOpen: folder.name === 'Landlord Compliance Documents',
      children: folderDocs.map(d => ({
        id: d.id,
        name: d.original_name,
        size: formatBytes(d.file_size_bytes),
        date: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '',
        scope: d.owner_type,
        entityId: d.owner_type === 'landlord' 
          ? (landRefMap[d.owner_id] || `LND-${d.owner_id}`) 
          : (propRefMap[d.owner_id] || `PRP-${d.owner_id}`),
        doc_reference: d.doc_reference
      }))
    };
  });

  res.json({
    success: true,
    data: responseData
  });
});

export const uploadDocument = catchAsync(async (req, res, next) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  const { scope, entityId } = req.body;
  if (!scope || !entityId) {
    throw new ApiError(400, 'Scope and Entity ID are required');
  }

  const parsedOwnerId = parseEntityId(entityId);

  // Determine correct folder
  let folderName = 'Landlord Compliance Documents';
  if (scope === 'property') {
    folderName = 'Property Gas & Safety Certs';
  } else if (scope === 'tenancy') {
    folderName = 'Tenancy Agreements & Deposits';
  }

  let folder = await db('folders').where('name', folderName).first();
  if (!folder) {
    const [fid] = await db('folders').insert({
      name: folderName,
      owner_type: 'global'
    });
    folder = { id: fid, name: folderName };
  }

  const file_path = `uploads/${req.file.filename}`;

  const tempRef = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const [documentId] = await db('documents').insert({
    folder_id: folder.id,
    owner_type: scope,
    owner_id: parsedOwnerId,
    doc_type: scope === 'landlord' ? 'kyc_document' : 'property_certificate',
    filename: req.file.filename,
    original_name: req.file.originalname,
    mime_type: req.file.mimetype,
    file_path: file_path,
    file_size_bytes: req.file.size,
    uploaded_by: req.user.id,
    doc_reference: tempRef
  });

  const doc_reference = `REM-DOC-${String(documentId).padStart(5, '0')}`;
  await db('documents')
    .where({ id: documentId })
    .update({ doc_reference });

  // Write audit log
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'DOCUMENT_UPLOADED',
    entity_type: 'document',
    entity_id: documentId,
    meta: JSON.stringify({ original_name: req.file.originalname, scope, owner_id: parsedOwnerId }),
    ip_address: req.ip || null
  });

  res.status(201).json({
    success: true,
    data: {
      id: documentId,
      filename: req.file.filename,
      original_name: req.file.originalname
    }
  });
});

export const deleteDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const doc = await db('documents').where('id', id).first();
  if (!doc) {
    throw new ApiError(404, 'Document not found');
  }

  // Remove file from disk
  const absolutePath = path.join(process.cwd(), doc.file_path);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (err) {
      logger.error(`Failed to delete file from disk at ${absolutePath}: ${err.message}`);
    }
  }

  // Delete from DB
  await db('documents').where('id', id).del();

  // Audit log
  await db('audit_log').insert({
    actor_id: req.user.id,
    actor_role: req.user.role,
    action: 'DOCUMENT_DELETED',
    entity_type: 'document',
    entity_id: id,
    meta: JSON.stringify({ original_name: doc.original_name, scope: doc.owner_type, owner_id: doc.owner_id }),
    ip_address: req.ip || null
  });

  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
});
