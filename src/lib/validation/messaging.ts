import { z } from "zod";
import { objectId, optionalId } from "./common";
import { MAX_FILES_PER_MESSAGE } from "./upload";

const content = z.string().trim().max(4000, "Message is too long (max 4000 characters)");
const attachmentIds = z.array(objectId).max(MAX_FILES_PER_MESSAGE, `Attach at most ${MAX_FILES_PER_MESSAGE} files`).default([]);

export const sendMessageSchema = z
  .object({
    conversationId: objectId,
    content,
    actAsDepartmentId: optionalId,
    attachmentIds,
  })
  .refine((d) => d.content.length > 0 || d.attachmentIds.length > 0, {
    path: ["content"],
    message: "Write a message or attach a file",
  });

export const startConversationSchema = z
  .object({
    // "employee:<id>" or "department:<id>"
    to: z.string().regex(/^(employee|department):[a-f\d]{24}$/i, "Choose a recipient"),
    // "me" or "department:<id>" (speaking on behalf of a department you head)
    from: z.string().regex(/^(me|department:[a-f\d]{24})$/i, "Invalid sender").default("me"),
    subject: z
      .string()
      .trim()
      .max(120, "Subject is too long")
      .optional()
      .transform((v) => v || undefined),
    content,
    attachmentIds,
  })
  .refine((d) => d.content.length > 0 || d.attachmentIds.length > 0, {
    path: ["content"],
    message: "Write a message or attach a file",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type StartConversationInput = z.infer<typeof startConversationSchema>;
