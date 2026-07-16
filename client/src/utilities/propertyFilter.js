// Shared helpers for scoping a list of records to the globally-selected property
// (from PropertyContext). `selectedProperty` is either the string "all" (or
// null before load) — meaning "no scoping" — or a formatted property object
// carrying `id`, `property_reference`, `name` and `address_line1`.
//
// Both helpers are GRACEFUL: if none of the records actually carry the property
// link (i.e. the backend hasn't started returning it yet), they return the list
// unchanged instead of hiding everything. That way selecting a property narrows
// the data where the API supports it, and is a harmless no-op where it doesn't.

export const ALL = "all";

const noScope = (selectedProperty) =>
  !selectedProperty || selectedProperty === ALL;

/**
 * Scope records that carry a numeric `property_id` (maintenance, inspections,
 * tenancies, utilities, statements, transactions …).
 */
export const filterByProperty = (
  records,
  selectedProperty,
  getId = (r) => r.property_id,
) => {
  if (noScope(selectedProperty) || !Array.isArray(records)) return records;
  // Graceful: if no record exposes an id, the data isn't property-scoped yet.
  if (!records.some((r) => getId(r) != null)) return records;
  return records.filter((r) => getId(r) === selectedProperty.id);
};

/**
 * Scope document-style records via their `related` array, which lists a
 * property's reference / name / address (documents, certificates …).
 */
export const filterByRelated = (
  records,
  selectedProperty,
  getRelated = (r) => r.related,
) => {
  if (noScope(selectedProperty) || !Array.isArray(records)) return records;
  const keys = [
    selectedProperty.property_reference,
    selectedProperty.name,
    selectedProperty.address_line1,
  ].filter(Boolean);
  // Graceful: if nothing carries a `related` list, don't hide everything.
  if (!records.some((r) => (getRelated(r) || []).length)) return records;
  return records.filter((r) => {
    const related = getRelated(r) || [];
    return keys.some((k) => related.includes(k));
  });
};

/**
 * Statements carry a cross-source `source_property_id` (a nullable string) plus
 * a `source` ("local" | "em") rather than a clean foreign key. Only
 * local-source statements reference a local property id, so resolve those to a
 * number (the portal filters on the numeric properties.id) and null otherwise.
 * Use as the `getId` argument to filterByProperty for statement records.
 */
export const statementPropertyId = (s) =>
  s && s.source === "local" && s.source_property_id != null
    ? Number(s.source_property_id)
    : null;
