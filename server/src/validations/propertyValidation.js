import { z } from "zod";

const requiredString = (message) => z.string({
  error: (issue) => issue.input === undefined ? message : "Must be a valid string"
});

export const createPropertySchema = z.object({
  landlord_id: z.coerce.number({
    required_error: "Landlord is required",
    invalid_type_error: "Landlord ID must be a number"
  }).int().positive(),

  address_line1: requiredString("Address Line 1 is required")
    .min(2, "Address Line 1 must be at least 2 characters"),

  address_line2: z.string().optional(),

  city: requiredString("City is required")
    .min(2, "City must be at least 2 characters"),

  postcode: requiredString("Postcode is required")
    .min(2, "Postcode must be at least 2 characters"),

  property_type: z.enum(['flat', 'house', 'HMO'], {
    errorMap: () => ({ message: "Property type must be flat, house, or HMO" })
  }).optional(),

  bedrooms: z.coerce.number().int().nonnegative().optional(),
  rent_pcm: z.coerce.number().nonnegative().optional(),
  mgmt_fee_pct: z.coerce.number().min(0).max(100).optional(),
  key_ref: z.string().optional(),
  name: z.string().optional()
});
