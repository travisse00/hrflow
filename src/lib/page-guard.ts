import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";

export const isObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

/**
 * For pages: turn "not found" and "not allowed" into the same 404 page, so a
 * stranger can't tell the difference between a record that doesn't exist and one
 * they aren't allowed to see.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof AppError && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) notFound();
    throw err;
  }
}
