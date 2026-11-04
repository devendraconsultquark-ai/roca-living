// Placeholders the landlord sheet import stored when the client's sheet had no
// email or phone (ROCA Estates requires both): never shown as if real.
export const isPlaceholderEmail = (v) => /\.invalid$/i.test(String(v || '').trim());
export const isPlaceholderPhone = (v) => /^0+$/.test(String(v || '').replace(/\s/g, ''));

export const realEmail = (v) => (v && !isPlaceholderEmail(v) ? v : null);
export const realPhone = (v) => (v && !isPlaceholderPhone(v) ? v : null);
