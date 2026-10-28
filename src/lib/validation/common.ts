import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

// HTML forms send "" for an empty select. Turn that into null ("none chosen").
export const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), objectId.nullable());

export const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const phoneField = z
  .string()
  .trim()
  .regex(/^[+\d\s()-]{7,20}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters") // bcrypt ignores everything after 72 bytes
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export function isRealDay(value: string): boolean {
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format")
  .refine(isRealDay, "That date doesn't exist");

export const optionalDay = z.preprocess((v) => (v === "" || v == null ? undefined : v), dayField.optional());

export const roleField = z.enum(["ADMIN", "HR_MANAGER", "EMPLOYEE"]);
