import { getCurrentUser } from "@/lib/auth/current-user";
import { AppError } from "@/lib/errors";
import { httpErrorResponse } from "@/lib/http";
import { storage } from "@/lib/storage";
import { isInlinePreviewable } from "@/lib/validation/upload";
import { getAttachmentForUser } from "@/modules/messaging/attachments";

// GET /api/attachments/:id            -> shows images / PDFs in the browser, downloads other types
// GET /api/attachments/:id?download=1 -> always downloads
//
// This is the ONLY way to read a file. Files live outside /public and their storage keys are
// never exposed, so knowing or guessing a URL gets you nothing without access to the conversation.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");

    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError("NOT_FOUND", "File not found.");

    const attachment = await getAttachmentForUser(user, id);

    let bytes: Buffer;
    try {
      bytes = await storage.get(attachment.storageKey);
    } catch {
      throw new AppError("NOT_FOUND", "File not found."); // record exists but the file is gone
    }

    const forceDownload = new URL(request.url).searchParams.get("download") === "1";
    const inline = !forceDownload && isInlinePreviewable(attachment.mimeType);
    const encodedName = encodeURIComponent(attachment.originalName);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff", // the browser must trust our Content-Type, never guess
        "Cache-Control": "private, no-store", // never cached by shared proxies or the CDN
      },
    });
  } catch (err) {
    return httpErrorResponse(err);
  }
}
