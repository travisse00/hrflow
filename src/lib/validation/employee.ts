import { z } from "zod";
import { emailField, objectId, optionalDay, optionalId, passwordField, phoneField, roleField } from "./common";

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name").max(100),
  email: emailField,
  phone: phoneField,
  position: z.string().trim().min(2, "Enter a position").max(80),
  departmentId: optionalId,
  role: roleField.optional(),
  dateJoined: optionalDay,
  password: passwordField,
});

export const updateEmployeeSchema = createEmployeeSchema.omit({ password: true }).extend({ id: objectId });

export const employeeStatusSchema = z.object({
  id: objectId,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const employeeListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  department: objectId.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  role: roleField.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
