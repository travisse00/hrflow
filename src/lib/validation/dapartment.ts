import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

// HTML forms send "" for an empty select. Turn that into null ("no parent", "no head").
const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), objectId.nullable());

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
  parentId: optionalId,
  headId: optionalId,
});

export const updateDepartmentSchema = departmentSchema.extend({ id: objectId });

export const assignEmployeeSchema = z.object({
  employeeId: objectId,
  departmentId: optionalId,
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;