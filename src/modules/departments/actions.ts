"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth/current-user";
import { safeAction, type ActionResult } from "@/lib/errors";
import { formToObject } from "@/lib/validation/auth";
import {
  assignEmployeeSchema,
  departmentSchema,
  updateDepartmentSchema,
} from "@/lib/validation/dapartment";
import { assignEmployeeToDepartment, createDepartment, updateDepartment } from "./service";

export async function createDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = departmentSchema.parse(formToObject(formData));
    await createDepartment(actor, input);
    revalidatePath("/departments");
  });
}

export async function updateDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = updateDepartmentSchema.parse(formToObject(formData));
    await updateDepartment(actor, input);
    revalidatePath("/departments");
    revalidatePath(`/departments/${input.id}`);
  });
}

export async function assignEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = assignEmployeeSchema.parse(formToObject(formData));
    await assignEmployeeToDepartment(actor, input.employeeId, input.departmentId);
    revalidatePath("/departments");
  });
}