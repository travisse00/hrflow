import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function FormField({ label, name, error, className = "", ...props }: FormFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted focus:ring-2 focus:ring-primary/40 ${
          error ? "border-danger" : "border-border focus:border-primary"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
