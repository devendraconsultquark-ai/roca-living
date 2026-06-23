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
