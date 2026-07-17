// Shared validation building blocks used across schemas.

// UK phone numbers only — mobiles (07…/+447…) and landlines (020 7123 4567 etc.).
// Single source of truth: auth register/profile, landlord create/update and the
// onboarding wizard must all accept exactly the same phone formats.
export const UK_PHONE_REGEX = /^(?:\+44\s?|0)(?:7\d{3}\s?\d{6}|[1-9]\d{1,4}\s?\d{3,4}\s?\d{3,4})$/;
export const UK_PHONE_MESSAGE = "Must be a valid UK phone number (e.g., 07123 456789 or 020 7123 4567)";
