import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const controlClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const invalidClass = 'border-red-400 focus:border-red-500 focus:ring-red-500/30';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Conteneur label + contrôle + message d'erreur, accessible (aria-*). */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className = '', id, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id: fieldId, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id ?? fieldId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${controlClass} ${invalid ? invalidClass : ''} ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className = '', id, rows = 4, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id: fieldId, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id ?? fieldId}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${controlClass} resize-y ${invalid ? invalidClass : ''} ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, className = '', id, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id: fieldId, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id ?? fieldId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={`${controlClass} ${invalid ? invalidClass : ''} ${className}`}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});
