// Shared by the browser (fast feedback before uploading) AND the server (the real check).
// The type of a file is decided by its extension plus its content signature, never by the
// MIME type the browser claims: browsers get that wrong (CSV is often "application/vnd.ms-excel")
// and a hostile client can send anything.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_MESSAGE = 5;

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export type UploadCheck = { ok: true; ext: string; mime: string } | { ok: false; message: string };

export function checkUploadMeta(fileName: string, size: number): UploadCheck {
  const ext = extensionOf(fileName);
  const mime = ALLOWED_EXTENSIONS[ext];
  if (!mime) {
    return { ok: false, message: "This file type isn't allowed. Use PDF, images, Office documents, TXT or CSV." };
  }
  if (size <= 0) return { ok: false, message: "This file is empty." };
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: `This file is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` };
  }
  return { ok: true, ext, mime };
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/** Magic-byte check: does the content really look like what the extension says? */
export function hasValidSignature(ext: string, bytes: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]); // GIF8
    case "webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "docx":
    case "xlsx":
    case "pptx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // zip container
    case "doc":
    case "xls":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]); // legacy OLE container
    case "txt":
    case "csv":
      return !bytes.subarray(0, 512).includes(0); // plain text never contains NUL bytes
    default:
      return false;
  }
}

/** Safe to show inside the page (an <img> or the browser's PDF viewer). */
export const isInlinePreviewable = (mime: string): boolean => mime.startsWith("image/") || mime === "application/pdf";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
