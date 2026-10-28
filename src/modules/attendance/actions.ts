"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth/current-user";
import { safeAction, type ActionResult } from "@/lib/errors";
import { clockIn, clockOut } from "./service";

// No form fields: WHO is clocking in comes from the session and WHEN comes from the server
// clock, so a client can never clock in for someone else or backdate a record.

export async function clockInAction(_prev: ActionResult | null, _formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    await clockIn(actor);
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}

export async function clockOutAction(_prev: ActionResult | null, _formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    await clockOut(actor);
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}
