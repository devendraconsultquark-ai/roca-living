// Consistent display of names that arrive in mixed styles (Rocaem often
// stores them in CAPITALS): "PAUL BELEMA AND MARCIA HUIZING" → "Paul Belema
// and Marcia Huizing", "GKP UK INVESTMENTS LTD" → "GKP UK Investments Ltd".
// Names already typed in mixed case are left exactly as entered.
const KEEP_UPPER = new Set(['UK', 'GB', 'BV', 'NV', 'LLP', 'PLC', 'GKP', 'RL', 'PH', 'DH', 'II', 'III', 'IV']);
const SPECIAL = { LTD: 'Ltd', LIMITED: 'Limited', AND: 'and', OF: 'of' };

const titleWord = (w) => w.split(/([-'’])/).map((p) => (/^[-'’]$/.test(p) ? p : p.charAt(0) + p.slice(1).toLowerCase())).join('');

export const niceName = (value) => {
  if (value === null || value === undefined) return value;
  const s = String(value).trim().replace(/\s+/g, ' ');
  if (!s || /[a-z]/.test(s)) return s; // already mixed case: keep as typed
  return s.split(' ').map((w, i) => {
    const bare = w.replace(/[^A-Z0-9]/g, '');
    if (SPECIAL[bare]) return i === 0 ? titleWord(w) : w.replace(bare, SPECIAL[bare]);
    if (KEEP_UPPER.has(bare) || (bare.length <= 3 && !/[AEIOUY]/.test(bare))) return w; // acronyms
    return titleWord(w);
  }).join(' ');
};
