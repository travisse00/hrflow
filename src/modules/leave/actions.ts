"use server";

import { revalidatePath } from "next/cache";
import { requireUserForAction } from "@/lib/auth/current-user";
import { safeAction, type ActionResult } from "@/lib/errors";
import { formToObject } from "@/lib/validation/auth";
import { leaveRequestSchema, reviewLeaveSchema } from "@/lib/validation/leave";
import { reviewLeaveRequest, submitLeaveRequest } from "./service";

export async function submitLeaveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = leaveRequestSchema.parse(formToObject(formData));
    await submitLeaveRequest(actor, input);
    revalidatePath("/leave");
    revalidatePath("/dashboard");
  });
}

export async function reviewLeaveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = reviewLeaveSchema.parse(formToObject(formData));
    await reviewLeaveRequest(actor, input);
    revalidatePath("/leave");
    revalidatePath("/dashboard");
  });
}
