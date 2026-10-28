"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { ActionResult } from "@/lib/errors";
import { loginAction } from "../actions";

export function LoginForm() {
  const [result, formAction] = useActionState<ActionResult | null, FormData>(loginAction, null);
  // Controlled so the email survives a failed attempt (React clears uncontrolled fields after an action).
  const [email, setEmail] = useState("");
  const fieldErrors = result && !result.ok ? result.error.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert result={result} />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors?.email?.[0]}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={fieldErrors?.password?.[0]}
      />
      <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
