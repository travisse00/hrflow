import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { storage } from "@/lib/storage";
import { checkUploadMeta, hasValidSignature } from "@/lib/validation/upload";
import { conversationVisibilityFilter } from "./visibility";

function safeFileName(name: string): string {
  // Keep the display name readable, but never let it carry path separators or control characters.
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\\/\u0000-\u001f<>:"|?*]/g, "_").trim();
  return cleaned.slice(0, 120) || "file";
}

/**
 * Step 1 of attaching a file: upload it. It is stored and recorded as an "orphan" owned by
 * the uploader; it only becomes visible to others once a message links it (step 2).
 */
export async function saveUpload(actor: CurrentUser, file: File) {
  const check = checkUploadMeta(file.name, file.size);
  if (!check.ok) throw new AppError("VALIDATION", check.message);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Re-check the real size and the real content: the size and name the browser reports can lie.
  if (checkUploadMeta(file.name, bytes.byteLength).ok === false) {
    throw new AppError("VALIDATION", "This file is empty or too large.");
  }
  if (!hasValidSignature(check.ext, bytes)) {
    throw new AppError("VALIDATION", "The file's contents don't match its type.");
  }

  const storageKey = await storage.put(bytes);
  try {
    return await prisma.attachment.create({
      data: {
        uploaderId: actor.id,
        originalName: safeFileName(file.name),
        mimeType: check.mime, // decided by us (from the extension), not by the client
        size: bytes.byteLength,
        storageKey,
      },
      select: { id: true, originalName: true, mimeType: true, size: true },
    });
  } catch (err) {
    await storage.remove(storageKey); // don't leave a file behind with no database record
    throw err;
  }
}

/**
 * Access check for downloads. The answer for "doesn't exist" and "not yours" is identical,
 * so nobody can probe which attachment ids exist.
 */
export async function getAttachmentForUser(actor: CurrentUser, id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      uploaderId: true,
      originalName: true,
      mimeType: true,
      size: true,
      storageKey: true,
      message: { select: { conversationId: true } },
    },
  });
  if (!attachment) throw new AppError("NOT_FOUND", "File not found.");

  if (!attachment.message) {
    // Uploaded but not yet sent: only the uploader may touch it.
    if (attachment.uploaderId !== actor.id) throw new AppError("NOT_FOUND", "File not found.");
    return attachment;
  }

  // Sent: you may open it only if you may see the conversation it was sent in.
  const filter = await conversationVisibilityFilter(actor);
  const allowed = await prisma.conversation.findFirst({
    where: { AND: [{ id: attachment.message.conversationId }, filter] },
    select: { id: true },
  });
  if (!allowed) throw new AppError("NOT_FOUND", "File not found.");
  return attachment;
}

/** Step 2 helper: confirm every id is an unsent upload by THIS user, so nobody can attach someone else's file. */
export async function claimableAttachmentIds(actorId: string, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = await prisma.attachment.findMany({
    where: { id: { in: unique }, uploaderId: actorId, OR: [{ messageId: null }, { messageId: { isSet: false } }] },
    select: { id: true },
  });
  if (rows.length !== unique.length) {
    throw new AppError("VALIDATION", "One of the attachments is invalid or was already used.", {
      content: ["Remove the attachment and upload it again"],
    });
  }
  return rows.map((r) => r.id);
}
