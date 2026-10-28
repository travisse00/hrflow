import type { ActionResult } from "@/lib/errors";

/** Shows a form-level error (wrong password, server problem...). Field errors show under each input. */
export function FormAlert({ result }: { result: ActionResult | null }) {
  if (!result || result.ok) return null;
  const { code, message } = result.error;
  // Validation problems are already shown next to the fields, so skip the banner.
  if (code === "VALIDATION") return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  );
}
