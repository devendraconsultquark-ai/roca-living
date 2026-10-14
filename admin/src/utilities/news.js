// Legislation & News: an item counts as "new" for this many days after it is
// published (Dashboard card, Legislation & News page, sidebar pill).
export const NEW_BADGE_DAYS = 14;

export const isNewsNew = (item) => (new Date() - new Date(item.published_on)) / 86400000 <= NEW_BADGE_DAYS;
