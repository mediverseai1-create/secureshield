"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: FieldError | string; hint?: string; children: ReactNode; htmlFor?: string }) {
  const message = typeof error === "string" ? error : error?.message;
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !message && <p className="mt-1 text-xs text-mute">{hint}</p>}
      {message && <p className="field-error">{message}</p>}
    </div>
  );
}

export function TextField({
  label,
  reg,
  error,
  type = "text",
  placeholder,
  hint,
  autoComplete,
  inputMode,
}: {
  label: string;
  reg: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email";
}) {
  return (
    <Field label={label} error={error} hint={hint} htmlFor={reg.name}>
      <input id={reg.name} type={type} className="input" placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} aria-invalid={!!error} {...reg} />
    </Field>
  );
}

export function SelectField({
  label,
  reg,
  error,
  options,
  placeholder,
}: {
  label: string;
  reg: UseFormRegisterReturn;
  error?: FieldError;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Field label={label} error={error} htmlFor={reg.name}>
      <select id={reg.name} className="input" aria-invalid={!!error} {...reg}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextArea({ label, reg, error, rows = 3, placeholder }: { label: string; reg: UseFormRegisterReturn; error?: FieldError; rows?: number; placeholder?: string }) {
  return (
    <Field label={label} error={error} htmlFor={reg.name}>
      <textarea id={reg.name} rows={rows} className="input" placeholder={placeholder} {...reg} />
    </Field>
  );
}

export function SubmitButton({ children, pending, className = "btn-primary", disabled }: { children: ReactNode; pending?: boolean; className?: string; disabled?: boolean }) {
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Submit button for plain <form action={serverAction}> forms. */
export function ActionButton({ children, className = "btn-outline btn-sm", confirm }: { children: ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** A GET form that resubmits itself whenever a control changes (search/filter bars). */
export function AutoSubmitForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <form
      ref={ref}
      method="get"
      className={className}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (timer.current) clearTimeout(timer.current);
        const delay = target instanceof HTMLInputElement && target.type === "search" ? 450 : 0;
        timer.current = setTimeout(() => ref.current?.requestSubmit(), delay);
      }}
    >
      {children}
    </form>
  );
}
