import { z } from "zod";
import { UK_PHONE_REGEX, UK_PHONE_MESSAGE } from "./common.js";

// Helper function to return a custom error message if the field is missing
const requiredString = (message) => z.string({
      error: (issue) => issue.input === undefined ? message : "Must be a valid string"
});

export const registerSchema = z.object({
      name: requiredString("Name is required")
            .min(2, "Name must be at least 2 characters"),

      email: requiredString("Email is required")
            .email("Invalid email format")
            .transform(val => val.toLowerCase()),

      password: requiredString("Password is required")
            .min(8, "Password must be at least 8 characters long")
            .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
            .regex(/[a-z]/, "Password must contain at least one lowercase letter")
            .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),

      phone: requiredString("Phone number is required")
            .regex(UK_PHONE_REGEX, UK_PHONE_MESSAGE),

      address: requiredString("Address is required")
            .min(5, "Address must be at least 5 characters")
});

export const loginSchema = z.object({
      email: requiredString("Email is required")
            .email("Invalid email format")
            .transform(val => val.toLowerCase()),

      password: requiredString("Password is required"),
      portal: z.string().optional(),
})

// All fields optional — this is a partial update of the caller's own profile.
export const updateProfileSchema = z.object({
      name: z.string().min(2, "Name must be at least 2 characters").optional(),
      email: z.string().email("Invalid email format").transform(val => val.toLowerCase()).optional(),
      phone: z.string()
            .regex(UK_PHONE_REGEX, UK_PHONE_MESSAGE)
            .optional(),
      address: z.string().min(5, "Address must be at least 5 characters").optional(),

      // Company / tax details (landlord_profiles)
      companyName: z.string().max(255, "Company name is too long").optional(),
      isOverseas: z.boolean().optional(),
      nrlHmrcApproved: z.boolean().optional(),
      nrlHmrcRef: z.string().max(100, "HMRC reference is too long").optional(),

      // Bank / payout details (landlord_payment_details). Empty strings are allowed
      // so a partially-filled form still saves the fields that were entered.
      bankName: z.string().max(255, "Bank name is too long").optional(),
      accountName: z.string().max(255, "Account name is too long").optional(),
      accountNumber: z.string()
            .regex(/^(\d{6,20})?$/, "Account number must be 6-20 digits")
            .optional(),
      sortCode: z.string()
            .regex(/^(\d{2}-?\d{2}-?\d{2})?$/, "Sort code must be in the format 12-34-56")
            .optional(),
      ibanBic: z.string().max(50, "IBAN/BIC is too long").optional(),
});

export const changePasswordSchema = z.object({
      currentPassword: requiredString("Current password is required"),
      newPassword: requiredString("New password is required")
            .min(8, "New password must be at least 8 characters long")
            .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
            .regex(/[a-z]/, "New password must contain at least one lowercase letter")
            .regex(/[^A-Za-z0-9]/, "New password must contain at least one special character"),
});
