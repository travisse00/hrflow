"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth/session";
import { safeAction, type ActionResult } from "@/lib/errors";
import { formToObject, loginSchema, registerSchema } from "@/lib/validation/auth";
import { authenticate, registerEmployee } from "./service";

// Signature (prevState, formData) is what React's useActionState expects.

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const input = registerSchema.parse(formToObject(formData));
    const employee = await registerEmployee(input);
    await createSession({ userId: employee.id, role: employee.role });
    redirect("/dashboard");
  });
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const input = loginSchema.parse(formToObject(formData));
    const employee = await authenticate(input);
    await createSession({ userId: employee.id, role: employee.role });
    redirect("/dashboard");
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
