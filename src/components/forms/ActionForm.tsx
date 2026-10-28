"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult, FieldErrors } from "@/lib/errors";
import { btnDanger, btnPrimary, btnSecondary } from "@/components/ui";
import { FormAlert } from "./FormAlert";

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface FormState {
  errors: FieldErrors | undefined;
  pending: boolean;
}

const FormStateContext = createContext<FormState>({ errors: undefined, pending: false });

/** Lets the field components below read their own validation error. */
export function useActionFormState(): FormState {
  return useContext(FormStateContext);
}

const VARIANT_CLASS = { primary: btnPrimary, secondary: btnSecondary, danger: btnDanger } as const;

interface ActionFormProps {
  action: FormAction;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  variant?: keyof typeof VARIANT_CLASS;
  className?: string;
}

/**
 * One form wrapper for every server action in the app: pending state, field errors,
 * a form-level error banner, a success message, optional confirm dialog.
 *
 * We submit through onSubmit + startTransition instead of <form action>, because React 19
 * clears every input after an action finishes, even a failed one, and losing what the
 * user typed whenever validation fails would be a bad experience.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving...",
  successMessage,
  resetOnSuccess = false,
  confirmMessage,
  variant = "primary",
  className = "space-y-4",
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const errors = state && !state.ok ? state.error.fieldErrors : undefined;

  return (
    <FormStateContext.Provider value={{ errors, pending }}>
      <form
        ref={formRef}
        noValidate
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
      >
        <FormAlert result={state} />
        {state?.ok && successMessage && (
          <div role="status" className="rounded-lg border border-border bg-soft px-3 py-2 text-sm text-primary-text">
            {successMessage}
          </div>
        )}
        {children}
        <button type="submit" disabled={pending} className={VARIANT_CLASS[variant]}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
    </FormStateContext.Provider>
  );
}
