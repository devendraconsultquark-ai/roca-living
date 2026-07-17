import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { formatBytes } from '../utils/format.js';

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

// The folder an admin files a document under drives the landlord-visible
// category (getMyDocuments derives category from doc_type). Folder names not
// in this map fall back to the scope default in DOC_TYPES.
const FOLDER_TO_DOC_TYPE = {
  'Landlord Compliance Documents': 'kyc_document',
  'Property Gas & Safety Certs': 'property_certificate',
  'Tenancy Agreements & Deposits': 'tenancy_agreement',
  'Statements': 'landlord_statement',
  'Invoices': 'landlord_invoice'
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
  const tenancies = await db('tenancies').select('id', 'property_id');

  const propRefMap = Object.fromEntries(properties.map(p => [p.id, p.property_reference]));
  const landRefMap = Object.fromEntries(landlords.map(l => [l.id, l.landlord_reference]));
  const tenancyPropMap = Object.fromEntries(tenancies.map(t => [t.id, t.property_id]));

  // Each owner_type resolves through its OWN reference map — tenancy docs show
  // the tenancy id plus the property it belongs to, never a bogus property ref.
  const entityRefFor = (d) => {
    if (d.owner_type === 'landlord') return landRefMap[d.owner_id] || `LND-${d.owner_id}`;
    if (d.owner_type === 'property') return propRefMap[d.owner_id] || `PRP-${d.owner_id}`;
    if (d.owner_type === 'tenancy') {
      const propRef = propRefMap[tenancyPropMap[d.owner_id]];
      return propRef ? `TCY-${d.owner_id} @ ${propRef}` : `TCY-${d.owner_id}`;
    }
    return '—'; // global / unattributed
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
        entityId: entityRefFor(d),
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

  const { scope, entityId, folderId } = req.body;
  if (!scope || !entityId) {
    throw new ApiError(400, 'Scope and Entity ID are required');
  }

  const parsedOwnerId = parseEntityId(entityId);
  if (!parsedOwnerId) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw new ApiError(400, 'A valid Entity ID is required');
  }

  // documents.owner_id has no FK, so validate the owner entity exists for the given scope.
  const ownerTables = { landlord: 'users', property: 'properties', tenancy: 'tenancies' };
  const ownerTable = ownerTables[scope];
  if (!ownerTable) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw new ApiError(400, `Unsupported document scope '${scope}'`);
  }
  const ownerQuery = db(ownerTable).where({ id: parsedOwnerId });
  if (scope === 'landlord') ownerQuery.andWhere({ role: 'LANDLORD' });
  const ownerExists = await ownerQuery.first();
  if (!ownerExists) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw new ApiError(404, `No ${scope} found with ID ${parsedOwnerId}`);
  }

  // Explicit folder choice wins; otherwise fall back to the scope default.
  let chosenFolder = null;
  if (folderId) {
    chosenFolder = await db('folders').where({ id: parseInt(folderId, 10) || 0 }).first();
    if (!chosenFolder) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      throw new ApiError(400, 'Selected folder does not exist');
    }
  }

  let folderName = 'Landlord Compliance Documents';
  if (scope === 'property') {
    folderName = 'Property Gas & Safety Certs';
  } else if (scope === 'tenancy') {
    folderName = 'Tenancy Agreements & Deposits';
  }

  const file_path = `uploads/${req.file.filename}`;

  // All writes in one transaction; unlink the already-written upload if it rolls back.
  let documentId;
  try {
    await db.transaction(async (trx) => {
      let folder = chosenFolder;
      if (!folder) {
        folder = await trx('folders').where('name', folderName).first();
      }
      if (!folder) {
        const [fid] = await trx('folders').insert({ name: folderName, owner_type: 'global' });
        folder = { id: fid, name: folderName };
      }

      const DOC_TYPES = { landlord: 'kyc_document', property: 'property_certificate', tenancy: 'tenancy_agreement' };
      // The resolved folder (explicit choice or scope default) drives doc_type,
      // so the admin's folder choice sets the landlord-visible category.
      const docType = FOLDER_TO_DOC_TYPE[folder.name] || DOC_TYPES[scope];
      const tempRef = `TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      [documentId] = await trx('documents').insert({
        folder_id: folder.id,
        owner_type: scope,
        owner_id: parsedOwnerId,
        doc_type: docType,
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        file_path: file_path,
        file_size_bytes: req.file.size,
        uploaded_by: req.user.id,
        doc_reference: tempRef
      });

      await trx('documents')
        .where({ id: documentId })
        .update({ doc_reference: `REM-DOC-${String(documentId).padStart(5, '0')}` });

      await trx('audit_log').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'DOCUMENT_UPLOADED',
        entity_type: 'document',
        entity_id: documentId,
        meta: JSON.stringify({ original_name: req.file.originalname, scope, owner_id: parsedOwnerId }),
        ip_address: req.ip || null
      });
    });
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw err;
  }

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

// Serve a stored document to its rightful viewer. Admin can download anything;
// a landlord only documents they own — directly (owner_type landlord), via one
// of their properties, or via a tenancy on one of their properties.
export const downloadDocument = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const doc = await db('documents').where('id', id).first();
  if (!doc) {
    throw new ApiError(404, 'Document not found');
  }

  if (req.user.role !== 'ADMIN') {
    let permitted = false;

    if (doc.owner_type === 'landlord') {
      permitted = doc.owner_id === req.user.id;
    } else if (doc.owner_type === 'property') {
      const property = await db('properties').where({ id: doc.owner_id, landlord_id: req.user.id }).first();
      permitted = !!property;
    } else if (doc.owner_type === 'tenancy') {
      const tenancy = await db('tenancies')
        .join('properties', 'tenancies.property_id', 'properties.id')
        .where('tenancies.id', doc.owner_id)
        .where('properties.landlord_id', req.user.id)
        .first();
      permitted = !!tenancy;
    }

    if (!permitted) {
      throw new ApiError(403, 'You do not have permission to access this document');
    }
  }

  // file_path is server-generated and stored relative to the app root; resolve
  // and confine it to the uploads directory to rule out traversal.
  const absolutePath = path.isAbsolute(doc.file_path)
    ? doc.file_path
    : path.join(process.cwd(), doc.file_path);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(uploadsDir))) {
    logger.warn(`Blocked document download outside uploads dir: ${resolved}`);
    throw new ApiError(404, 'Document file not found');
  }

  if (!fs.existsSync(resolved)) {
    logger.warn(`Document missing on disk: ${resolved}`);
    throw new ApiError(404, 'Document file not found');
  }

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${(doc.original_name || doc.filename || 'document').replace(/"/g, '')}"`);
  res.sendFile(resolved);
});

export const getMyDocuments = catchAsync(async (req, res, next) => {
  const landlordId = req.user.id;

  const landlordDocs = await db('documents').where({ owner_type: 'landlord', owner_id: landlordId });

  const propertyIds = await db('properties').where({ landlord_id: landlordId }).pluck('id');
  let propertyDocs = [];
  let tenancyDocs = [];

  if (propertyIds.length > 0) {
    propertyDocs = await db('documents')
      .where('owner_type', 'property')
      .whereIn('owner_id', propertyIds);

    const tenancyIds = await db('tenancies').whereIn('property_id', propertyIds).pluck('id');
    if (tenancyIds.length > 0) {
      tenancyDocs = await db('documents')
        .where('owner_type', 'tenancy')
        .whereIn('owner_id', tenancyIds);
    }
  }

  const allDocs = [...landlordDocs, ...propertyDocs, ...tenancyDocs];

  let propMap = {};
  if (propertyIds.length > 0) {
    const properties = await db('properties').whereIn('id', propertyIds).select('id', 'property_reference', 'name', 'address_line1');
    propMap = Object.fromEntries(properties.map(p => [p.id, p]));
  }

  const landlordProfile = await db('landlord_profiles').where('user_id', landlordId).first();
  const landlordRef = landlordProfile ? landlordProfile.landlord_reference : `LND-${landlordId}`;

  let tenancyToPropMap = {};
  if (propertyIds.length > 0) {
    const tenancies = await db('tenancies').whereIn('property_id', propertyIds).select('id', 'property_id');
    tenancyToPropMap = Object.fromEntries(tenancies.map(t => [t.id, t.property_id]));
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.log(bytes) / Math.log(k) ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formattedDocs = allDocs.map(d => {
    let related = '';
    let category = '';

    if (d.owner_type === 'landlord') {
      related = `Landlord Profile`;
    } else if (d.owner_type === 'property') {
      const p = propMap[d.owner_id];
      related = p ? (p.name || p.address_line1 || p.property_reference) : `Property ${d.owner_id}`;
    } else if (d.owner_type === 'tenancy') {
      const pId = tenancyToPropMap[d.owner_id];
      const p = propMap[pId];
      related = p ? `Tenancy at ${p.name || p.address_line1 || p.property_reference}` : `Tenancy ${d.owner_id}`;
    }

    if (d.doc_type === 'landlord_statement') {
      category = 'Statements';
    } else if (d.doc_type === 'landlord_invoice') {
      category = 'Invoices';
    } else if (d.doc_type === 'kyc_document') {
      category = 'Compliance';
    } else if (d.doc_type === 'property_certificate') {
      category = 'Certificates';
    } else if (d.doc_type === 'tenancy_agreement') {
      category = 'Tenancy';
    } else {
      category = 'Other';
    }

    return {
      id: d.id,
      item: d.original_name,
      category,
      related,
      uploaded: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '',
      file_path: d.file_path,
      size: formatBytes(d.file_size_bytes)
    };
  });

  res.json({
    success: true,
    data: formattedDocs
  });
});
