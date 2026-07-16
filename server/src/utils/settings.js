import db from '../config/db.js';

// Read a single system setting (admin Settings page), falling back when the
// key is missing or unreadable. Values are stored as strings.
export const getSetting = async (key, fallback = null) => {
  try {
    const row = await db('settings').where({ key }).first();
    return row && row.value !== null && row.value !== undefined && row.value !== ''
      ? row.value
      : fallback;
  } catch {
    return fallback;
  }
};

export const getNumericSetting = async (key, fallback) => {
  const raw = await getSetting(key, null);
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : fallback;
};
