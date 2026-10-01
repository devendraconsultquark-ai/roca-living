// Shared validation building blocks used across schemas.
import { ApiError } from "../utils/ApiError.js";

// Phone numbers — one rule for every form (profile, sign-up, landlords,
// tenants, contractors, letting agents, contact form). Accepts any common UK
// format (07123 456789, 07123-456789, +44 (0)7123 456789, 020 7123 4567) and
// international numbers starting with + or 00 (many ROCA landlords live in
// the Netherlands: +31 6 1234 5678). The number is stored as typed.
export const PHONE_MESSAGE = "Enter a valid phone number, e.g. 07123 456789 or +31 6 1234 5678";

export const isValidPhone = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return false;
  let digits = raw.replace(/\(0\)/, "").replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+44")) return /^\+44[1-9]\d{8,9}$/.test(digits);
  if (digits.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(digits);
  return /^0[1-9]\d{8,9}$/.test(digits);
};

// For controllers that take a phone without a schema. Empty is allowed
// (phone is optional there); anything else must pass the rule.
export const checkPhone = (value, label = "Phone number") => {
  if (value === undefined || value === null || String(value).trim() === "") return;
  if (!isValidPhone(value)) {
    throw new ApiError(400, `${label}: ${PHONE_MESSAGE}`, [{ field: "phone", message: PHONE_MESSAGE }]);
  }
};
