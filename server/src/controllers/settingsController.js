import db from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getSettings = catchAsync(async (req, res, next) => {
  const settingsList = await db('settings').select('*');
  const settingsMap = {};
  settingsList.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  res.json({
    success: true,
    data: settingsMap
  });
});

export const updateSettings = catchAsync(async (req, res, next) => {
  const settings = req.body; // e.g. { agencyFee: '12.0', vatRate: '20.0', depositSchemeNum: 'TDS-ROCA-5001' }

  await db.transaction(async (trx) => {
    for (const [key, value] of Object.entries(settings)) {
      // Upsert settings
      const exists = await trx('settings').where({ key }).first();
      if (exists) {
        await trx('settings').where({ key }).update({ value: String(value), updated_at: trx.fn.now() });
      } else {
        await trx('settings').insert({ key, value: String(value) });
      }
    }
  });

  const updatedList = await db('settings').select('*');
  const settingsMap = {};
  updatedList.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: settingsMap
  });
});
