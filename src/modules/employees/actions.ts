"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserForAction } from "@/lib/auth/current-user";
import { safeAction, type ActionResult } from "@/lib/errors";
import { formToObject } from "@/lib/validation/auth";
import { createEmployeeSchema, employeeStatusSchema, updateEmployeeSchema } from "@/lib/validation/employee";
import { createEmployee, setEmployeeStatus, updateEmployee } from "./service";

export async function createEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = createEmployeeSchema.parse(formToObject(formData));
    const { id } = await createEmployee(actor, input);
    revalidatePath("/employees");
    redirect(`/employees/${id}`);
  });
}

export async function updateEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = updateEmployeeSchema.parse(formToObject(formData));
    await updateEmployee(actor, input);
    revalidatePath("/employees");
    revalidatePath(`/employees/${input.id}`);
    redirect(`/employees/${input.id}`);
  });
}

export async function setEmployeeStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = employeeStatusSchema.parse(formToObject(formData));
    await setEmployeeStatus(actor, input.id, input.status);
    revalidatePath("/employees");
    revalidatePath(`/employees/${input.id}`);
    revalidatePath("/departments", "layout");
  });
}
