import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Where uploaded file BYTES live. MongoDB only stores metadata plus an opaque key.
 * To move to S3 / R2 / Azure Blob, implement this interface and change the export at the
 * bottom. Nothing else in the app needs to change.
 */
export interface StorageProvider {
  put(data: Uint8Array): Promise<string>; // returns the storage key
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

// Keys are always server-generated UUIDs; refusing anything else makes path traversal impossible.
const KEY_PATTERN = /^[a-f0-9-]{36}$/;

class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
    return path.join(this.root, key);
  }

  async put(data: Uint8Array): Promise<string> {
    const key = randomUUID();
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.resolve(key), data, { flag: "wx" });
    return key;
  }

  get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

// Files are stored OUTSIDE /public, so the web server never serves them directly.
// The only way to read one is through /api/attachments/[id], which checks permissions.
export const storage: StorageProvider = new LocalDiskStorage(
  path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./storage/uploads"),
);