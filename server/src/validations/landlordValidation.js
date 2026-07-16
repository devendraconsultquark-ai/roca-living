import { z } from "zod";

const requiredString = (message) => z.string({
  error: (issue) => issue.input === undefined ? message : "Must be a valid string"
});

export const createLandlordSchema = z.object({
  name: requiredString("Name is required")
    .min(2, "Name must be at least 2 characters"),

  email: requiredString("Email is required")
    .email("Invalid email format")
    .transform(val => val.toLowerCase()),

  phone: requiredString("Phone number is required")
    .min(5, "Phone number is required"),

  address: z.string().optional().default(''),
  company_name: z.string().optional(),
  is_overseas: z.boolean().optional(),
  ownership_share: z.number().optional(),
  tob_status: z.string().optional()
});

// Columns bank_name/account_name/account_number/sort_code are NOT NULL in
// landlord_payment_details — reject missing values here instead of 500ing.
export const updatePaymentDetailsSchema = z.object({
  bank_name: requiredString("Bank name is required")
    .min(2, "Bank name must be at least 2 characters")
    .max(255, "Bank name is too long"),

  account_name: requiredString("Account name is required")
    .min(2, "Account name must be at least 2 characters")
    .max(255, "Account name is too long"),

  account_number: requiredString("Account number is required")
    .regex(/^\d{6,20}$/, "Account number must be 6-20 digits"),

  sort_code: requiredString("Sort code is required")
    .regex(/^\d{2}-?\d{2}-?\d{2}$/, "Sort code must be in the format 00-00-00"),

  iban_bic: z.string().max(50, "IBAN/BIC is too long").optional().nullable()
});
