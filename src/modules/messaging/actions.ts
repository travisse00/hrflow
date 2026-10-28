"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserForAction } from "@/lib/auth/current-user";
import { safeAction, type ActionResult } from "@/lib/errors";
import { formToObject } from "@/lib/validation/auth";
import { sendMessageSchema, startConversationSchema } from "@/lib/validation/messaging";
import { sendMessage, startConversation } from "./service";

// formToObject() keeps only the LAST value for a repeated field, so the attachment ids
// (one hidden input per file) are collected separately with getAll().

export async function sendMessageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = sendMessageSchema.parse({ ...formToObject(formData), attachmentIds: formData.getAll("attachmentIds") });
    await sendMessage(actor, input);
    revalidatePath("/messages", "layout"); // refreshes the open thread AND the conversation list
    revalidatePath("/dashboard");
  });
}

export async function startConversationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return safeAction<void>(async () => {
    const actor = await requireUserForAction();
    const input = startConversationSchema.parse({ ...formToObject(formData), attachmentIds: formData.getAll("attachmentIds") });
    const { id } = await startConversation(actor, input);
    revalidatePath("/messages", "layout");
    revalidatePath("/dashboard");
    redirect(`/messages/${id}`);
  });
}
