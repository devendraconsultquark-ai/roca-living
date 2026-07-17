import { z } from "zod";

// Helper function to return a custom error message if the field is missing
const requiredString = (message) => z.string({
      error: (issue) => issue.input === undefined ? message : "Must be a valid string"
});

// Public website enquiry form. Phone is deliberately loose (not UK-only) —
// prospective overseas landlords use this form.
export const contactSchema = z.object({
      firstName: requiredString("First name is required")
            .min(1, "First name is required")
            .max(100, "First name is too long"),

      lastName: requiredString("Last name is required")
            .min(1, "Last name is required")
            .max(100, "Last name is too long"),

      email: requiredString("Email is required")
            .email("Invalid email format")
            .transform(val => val.toLowerCase()),

      phone: requiredString("Phone number is required")
            .min(7, "Phone number is too short")
            .max(30, "Phone number is too long")
            .regex(/^[+\d\s()-]+$/, "Phone number contains invalid characters"),

      message: requiredString("Message is required")
            .min(5, "Message must be at least 5 characters")
            .max(5000, "Message is too long"),

      company: z.string().max(255, "Company name is too long").optional(),
      location: z.string().max(255, "Location is too long").optional(),
      enquiryType: z.array(z.string().max(100)).max(10).optional(),
});
