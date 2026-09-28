import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import logger from './logger.js';
import { generatePortraitPDFWithPuppeteer } from './puppeteerGenerator.js';
import { rocaLivingStatementPdfHtml } from '../templates/rocaLivingStatementTemplate.js';

// RL-P03 check 7: a statement may only say the payment was "Transferred" once
// the landlord payout is confirmed (status paid — marked by hand or matched in
// Xero). The stored PDF is redrawn from its saved data whenever its wording no
// longer matches the status, just before it is downloaded or emailed, so no
// payment flow has to know about PDFs.
export const ensureStatementPdfCurrent = async (statement) => {
  if (!statement?.render_data) return statement; // older statements: left as issued
  const paid = statement.status === 'paid';
  if (!!statement.pdf_paid === paid) return statement;

  try {
    const { statementData, invoiceData } = JSON.parse(statement.render_data);
    const pdf = await generatePortraitPDFWithPuppeteer(
      rocaLivingStatementPdfHtml({ ...statementData, payment_confirmed: paid }, invoiceData),
      { fullBleed: true }
    );
    const doc = await db('documents').where('id', statement.document_id).first();
    if (!doc) return statement;
    const abs = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(process.cwd(), doc.file_path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, pdf);
    await db('documents').where('id', doc.id).update({ file_size_bytes: pdf.length });
    await db('landlord_statements').where('id', statement.id).update({ pdf_paid: paid });
    return { ...statement, pdf_paid: paid };
  } catch (err) {
    logger.error(`[StatementPdf] Could not refresh statement ${statement.id}: ${err.message}`);
    return statement; // serve the existing PDF rather than fail the download
  }
};
