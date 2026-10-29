// One capitalisation for every field label and heading: each word starts with a
// capital ("Right to Rent Expiry", "Rent Due Day"), except short joining words
// in the middle (to, of, and, in…). Words already holding capitals, digits or
// symbols are left as written (NRL, HMRC, PH_33, £, e.g.). Non-strings (icons,
// bold parts) are returned unchanged.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'via', 'vs', 'with']);
// Units and brand names stay as written ("Area (sqft)", "£ pcm", "mydeposits").
const UNITS = new Set(['sqft', 'pcm', 'pa', 'pw', 'kg', 'm²', 'mydeposits']);
// Surname particles in people's names are never changed ("Matthijs van Leeuwen").
const NAME_PARTICLES = new Set(['van', 'von', 'de', 'der', 'den', 'du', 'da', 'di', 'del', 'la', 'le', 'ten', 'ter', 'bin', 'al']);

export const titleCase = (text) => {
  if (typeof text !== 'string') return text;
  const words = text.split(/(\s+)/);
  const last = words.length - 1;
  return words.map((w, i) => {
    if (!w.trim()) return w;
    // Only plain lower-case words change (keeps "NRL", "e.g.", "PH_33", "(HMRC)", "£").
    const m = w.match(/^([("'“]*)([a-z][a-z'’-]*)([)"'”:,.?!]*)$/);
    if (!m) return w;
    const [, pre, core, post] = m;
    if (UNITS.has(core) || (i !== 0 && NAME_PARTICLES.has(core)) || (i !== 0 && i !== last && SMALL.has(core))) return w;
    return `${pre}${core.charAt(0).toUpperCase()}${core.slice(1)}${post}`;
  }).join('');
};
