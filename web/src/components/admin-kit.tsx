"use client";

// Small form parts shared by the admin panel's tabs.
import { Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button, Field, inputClass } from "./ui";

/** Runs a save, reports failures, and refreshes the catalog afterwards. `done` is shown as a confirmation. */
export type Run = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

// ------------------------------------------------------------------ small form parts
export function Text({
  label,
  value,
  onChange,
  hint,
  error,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string | null } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest} />
    </Field>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-label font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--color-leaf-600)]" />
      {label}
    </label>
  );
}

export function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {children}
      </select>
    </Field>
  );
}

export function ConfirmDelete({ what, onDelete }: { what: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <span className="flex items-center gap-2">
      <Button variant="danger" onClick={onDelete}>
        Delete {what}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Keep
      </Button>
    </span>
  ) : (
    <Button variant="ghost" className="text-chili-600" onClick={() => setAsking(true)}>
      <Trash2 className="size-4" aria-hidden />
      Delete
    </Button>
  );
}

export const toCents = (dollars: string) => {
  const n = Number(dollars.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && dollars.trim() !== "" ? Math.round(n * 100) : null;
};
export const toDollars = (cents: number) => (cents / 100).toFixed(2);
export const blankToNull = (s: string) => s.trim() || null;
