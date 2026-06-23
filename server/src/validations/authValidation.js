import { z } from "zod";

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
            .regex(
                  /^(?:\+44\s?|0)(?:7\d{3}\s?\d{6}|[1-9]\d{1,4}\s?\d{3,4}\s?\d{3,4})$/,
                  "Must be a valid UK phone number (e.g., 07123 456789 or 020 7123 4567)"
            ),

      address: requiredString("Address is required")
            .min(5, "Address must be at least 5 characters")
});

export const loginSchema = z.object({
      email: requiredString("Email is required")
            .email("Invalid email format")
            .transform(val => val.toLowerCase()),

      password: requiredString("Password is required"),
})
