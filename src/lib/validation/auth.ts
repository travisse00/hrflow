import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email,
    phone: z
      .string()
      .trim()
      .regex(/^[+\d\s()-]{7,20}$/, "Enter a valid phone number")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    position: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : undefined)),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use at most 72 characters") // bcrypt ignores everything after 72 bytes
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Turns a <form> submission into a plain object for zod to parse. */
export function formToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}