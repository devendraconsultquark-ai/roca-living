// Derive statement initials from a landlord's full name, per the statement
// Excel spec: "Ravi Bakshi" -> "RB", joint names "Ravi Bakshi & Gita Han" ->
// "RB/GH", single-word names use the first two letters. Titles are stripped.
// Returns '' when nothing usable can be derived.
export const deriveInitials = (name) => {
  if (!name) return '';
  const clean = name.replace(/(Mr|Mrs|Ms|Dr|Prof|Messrs)\.?\s+/gi, '');
  const parts = clean.split(/\s+&\s+|\s+and\s+/i);
  const initialsList = parts.map(part => {
    const words = part.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return '';
  }).filter(Boolean);
  return initialsList.join('/');
};
