"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/forms/SubmitButton";
import type { ActionResult } from "@/lib/errors";
import { registerAction } from "../actions";

export function RegisterForm() {
  const [result, formAction] = useActionState<ActionResult | null, FormData>(registerAction, null);
  // Text fields are controlled so they survive a failed submit. Passwords are
  // deliberately left uncontrolled: they get cleared, which is what you want.
  const [values, setValues] = useState({ fullName: "", email: "", phone: "", position: "" });
  const fieldErrors = result && !result.ok ? result.error.fieldErrors : undefined;

  const bind = (name: keyof typeof values) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert result={result} />
      <FormField label="Full name" name="fullName" autoComplete="name" {...bind("fullName")} error={fieldErrors?.fullName?.[0]} />
      <FormField label="Email" name="email" type="email" autoComplete="email" {...bind("email")} error={fieldErrors?.email?.[0]} />
      <FormField label="Phone (optional)" name="phone" type="tel" autoComplete="tel" {...bind("phone")} error={fieldErrors?.phone?.[0]} />
      <FormField label="Position (optional)" name="position" {...bind("position")} error={fieldErrors?.position?.[0]} />
      <FormField label="Password" name="password" type="password" autoComplete="new-password" error={fieldErrors?.password?.[0]} />
      <FormField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" error={fieldErrors?.confirmPassword?.[0]} />
      <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
    </form>
  );
}
