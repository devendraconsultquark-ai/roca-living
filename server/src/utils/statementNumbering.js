import { ApiError } from './ApiError.js';

// Statement / invoice numbering per "Statement Logic.xlsx":
//   statement  {block}_{apartment}_{seq}       e.g. PH_19_0001
//   invoice    INV_{block}_{apartment}_{seq}   e.g. INV_PH_19_0001
//   landlord   RL_LR_{block}_{apartment}       property  {block}-{apartment}
// Shared by the manual Statements form (autofill) and the Statement Generator.

export const parseBlockName = (name, blockDb) => {
  if (blockDb) return blockDb;
  if (!name) return 'SA';
  const upper = name.toUpperCase();
  if (upper.includes('PARSONS HOUSE') || upper.includes('PH')) return 'PH';
  if (upper.includes('DARWENT HOUSE') || upper.includes('DH')) return 'DH';
  const words = name.split(' ').filter(w => w.length > 0);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const parseApartmentNumber = (name, aptDb, unitCode) => {
  if (aptDb) return aptDb;
  if (unitCode) {
    const m = unitCode.match(/\d+/);
    if (m) return m[0];
  }
  if (!name) return '';
  const match = name.match(/(?:Unit|Apartment|Flat|Apt)\s*(\d+)/i) || name.match(/\b(\d+)\b/);
  return match ? match[1] : '';
};

// Block code / apartment number as saved on a property: short letters/digits
// only (PH, 33), uppercased, empty → null. Free text would break the numbers.
export const cleanUnitCode = (value, label) => {
  if (value === undefined) return undefined;
  const v = String(value ?? '').trim().toUpperCase();
  if (!v) return null;
  if (!/^[A-Z0-9]{1,10}$/.test(v)) {
    throw new ApiError(400, `${label} must be a short code of letters/numbers only (e.g. ${label.startsWith('Block') ? 'PH' : '33'})`);
  }
  return v;
};

// Next 4-digit sequence for numbers starting with `prefix` in `existingList[field]`.
export const getNextSeq = (prefix, existingList, field) => {
  let nextVal = 1;
  const matches = existingList.filter(item => item[field] && item[field].startsWith(prefix));
  if (matches.length > 0) {
    const nums = matches.map(item => {
      const parts = item[field].split('_');
      const lastPart = parts[parts.length - 1];
      const val = parseInt(lastPart, 10);
      return isNaN(val) ? 0 : val;
    });
    nextVal = Math.max(...nums) + 1;
  }
  return String(nextVal).padStart(4, '0');
};

// Format a landlord NRL reference as "{Initials}:{NRL}" (per landlord initial), e.g. "RB:NL945005".
// An NRL already written out per landlord (joint owners with their own numbers,
// e.g. "MVL - PX870568A, ML - 922/NL942174") is used exactly as stored.
export const formatNrl = (rawNrl, initials) => {
  const nrl = String(rawNrl || '').trim();
  if (!nrl) return '';
  if (/[\s:,·/-]/.test(nrl) || !initials) return nrl;
  return initials.split('/').map(ini => `${ini}:${nrl}`).join(' / ');
};
