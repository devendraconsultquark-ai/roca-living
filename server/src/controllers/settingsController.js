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

// Only these keys may be written; anything else is rejected to keep the table clean.
const ALLOWED_SETTING_KEYS = ['agencyFee', 'vatRate', 'depositSchemeNum', 'repairApprovalLimit'];

export const updateSettings = catchAsync(async (req, res, next) => {
  const settings = req.body; // e.g. { agencyFee: '12.0', vatRate: '20.0', depositSchemeNum: 'TDS-ROCA-5001' }

  const keys = Object.keys(settings || {});
  if (keys.length === 0) {
    throw new ApiError(400, 'No settings provided');
  }
  const invalid = keys.filter(k => !ALLOWED_SETTING_KEYS.includes(k));
  if (invalid.length > 0) {
    throw new ApiError(400, `Unknown setting key(s): ${invalid.join(', ')}`);
  }
  // The fee is copied onto every flat newly managed by ROCA Living, so a typo
  // (80 instead of 8) would be charged on its statements.
  const inRange = (value, max) => {
    const n = Number(value);
    return String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max;
  };
  if ('agencyFee' in settings && !inRange(settings.agencyFee, 30)) {
    throw new ApiError(400, 'Management fee must be between 0 and 30%');
  }
  if ('vatRate' in settings && !inRange(settings.vatRate, 100)) {
    throw new ApiError(400, 'VAT rate must be between 0 and 100%');
  }
  if ('repairApprovalLimit' in settings && !inRange(settings.repairApprovalLimit, 100000)) {
    throw new ApiError(400, 'The repair approval limit must be between £0 and £100,000');
  }

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

    // Audit the change, consistent with other privileged mutations.
    await trx('audit_log').insert({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'SETTINGS_UPDATED',
      entity_type: 'settings',
      entity_id: null,
      meta: JSON.stringify(settings),
      ip_address: req.ip || null
    });
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
