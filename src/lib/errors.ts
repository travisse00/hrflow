import { Prisma } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export type FieldErrors = Record<string, string[]>;

/** An error we threw on purpose. Its message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors } };

function zodToFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wrap every server action in this. It turns anything that can go wrong into a
 * predictable { ok, data | error } shape and never leaks stack traces or DB details.
 */
export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // redirect() / notFound() work by throwing; they must keep flowing up to Next.
    unstable_rethrow(err);

    if (err instanceof ZodError) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors: zodToFieldErrors(err) },
      };
    }
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return { ok: false, error: { code: "CONFLICT", message: "That record already exists." } };
      }
      if (err.code === "P2025") {
        return { ok: false, error: { code: "NOT_FOUND", message: "Record not found." } };
      }
    }
    console.error("[action error]", err); // full detail stays in server logs only
    return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
  }
}
