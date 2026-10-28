"use client";

import type { ComponentProps } from "react";
import { inputClass } from "@/components/ui";
import { useActionFormState } from "./ActionForm";
import { FormField } from "./FormField";

/** Text-like input that shows its own validation error from the surrounding ActionForm. */
export function Field(props: Omit<ComponentProps<typeof FormField>, "error">) {
  const { errors } = useActionFormState();
  return <FormField {...props} error={errors?.[props.name]?.[0]} />;
}

interface SelectFieldProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string; // adds an empty first option
  required?: boolean;
}

export function SelectField({ label, name, options, defaultValue = "", placeholder, required }: SelectFieldProps) {
  const { errors } = useActionFormState();
  const error = errors?.[name]?.[0];
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`${inputClass} ${error ? "border-danger" : ""}`}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${name}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}

export function TextAreaField({ label, name, defaultValue, placeholder, rows = 3 }: TextAreaFieldProps) {
  const { errors } = useActionFormState();
  const error = errors?.[name]?.[0];
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`${inputClass} ${error ? "border-danger" : ""}`}
      />
      {error && (
        <p id={`${name}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
