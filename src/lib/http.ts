import { AppError, type ErrorCode } from "@/lib/errors";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
};

/** Route-handler equivalent of safeAction(): same error codes, JSON + HTTP status. */
export function httpErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
  }
  console.error("[route error]", err); // detail stays in server logs
  return Response.json({ error: "Something went wrong. Please try again.", code: "INTERNAL" }, { status: 500 });
}
