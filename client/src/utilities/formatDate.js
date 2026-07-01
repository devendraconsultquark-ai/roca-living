/**
 * Safely formats an ISO date string into standard UK format (DD/MM/YYYY).
 * Returns a fallback string if the date is invalid or missing.
 * @param {string|Date} dateVal - The date representation
 * @param {string} fallback - Fallback string if invalid (defaults to '-')
 * @returns {string} Formatted date string
 */
export const formatDate = (dateVal, fallback = '-') => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-GB');
  } catch (err) {
    console.error('Date formatting error:', err);
    return fallback;
  }
};

/**
 * Safely formats an ISO date string into standard UK date-time format (DD/MM/YYYY, HH:MM).
 * @param {string|Date} dateVal 
 * @param {string} fallback 
 * @returns {string} Formatted date-time string
 */
export const formatDateTime = (dateVal, fallback = '-') => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleString('en-GB');
  } catch (err) {
    console.error('Date-time formatting error:', err);
    return fallback;
  }
};
