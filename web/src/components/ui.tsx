import Link from "next/link";
import { LoaderCircle, Utensils } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import type { Diet } from "@/lib/types";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ------------------------------------------------------------------ buttons
type Variant = "primary" | "dark" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-ember-500 text-night-900 hover:bg-ember-400 active:bg-ember-600",
  dark: "bg-night-900 text-white hover:bg-night-800 active:bg-night-950",
  outline: "border border-line bg-white text-ink-900 hover:bg-surface-1 active:bg-surface-2",
  ghost: "text-ink-700 hover:bg-surface-1 active:bg-surface-2",
  danger: "border border-line bg-white text-chili-600 hover:bg-chili-50",
  success: "bg-leaf-600 text-white hover:bg-leaf-700",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3 text-label",
  md: "h-11 px-4 text-[0.9375rem] leading-5",
  lg: "h-13 px-5 text-body",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  // Press feedback: buttons scale to 0.96; full-width buttons are wide surfaces, so they only darken.
  const wide = className?.split(/\s+/).includes("w-full");
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap select-none",
    "transition-[background-color,color,scale] duration-150 ease-enter",
    !wide && "active:scale-[0.96]",
    "disabled:bg-surface-2 disabled:text-ink-500 disabled:border-transparent disabled:active:scale-100",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="spinner-delayed size-4" aria-hidden />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ------------------------------------------------------------------ diet mark
const dietInfo: Record<Diet, { label: string; color: string }> = {
  veg: { label: "Vegetarian", color: "var(--color-leaf-600)" },
  egg: { label: "Contains egg", color: "var(--color-egg-600)" },
  nonveg: { label: "Non-vegetarian", color: "var(--color-chili-600)" },
};

/** The Indian veg / egg / non-veg mark. Renders nothing when the menu does not say. */
export function DietMark({ diet, className }: { diet: Diet | null; className?: string }) {
  if (!diet) return null;
  const { label, color } = dietInfo[diet];
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} role="img" aria-label={label}>
      <rect x="1" y="1" width="14" height="14" rx="3" fill="white" stroke={color} strokeWidth="1.5" />
      {diet === "nonveg" ? <path d="M8 4.4 11.6 11H4.4z" fill={color} /> : <circle cx="8" cy="8" r="3.3" fill={color} />}
    </svg>
  );
}

// ------------------------------------------------------------------ images
/**
 * Catalog photo with a quiet fallback when an item has none.
 * The photo multiplies onto a tinted tile, so dishes shot on a white background lose the white box.
 */
export function FoodImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-1 text-ink-300", className)} aria-hidden>
        <Utensils className="size-6" />
      </div>
    );
  }
  return (
    <span className={cn("isolate block overflow-hidden bg-surface-1", className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover mix-blend-multiply" />
    </span>
  );
}

// ------------------------------------------------------------------ layout bits
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 md:px-6", className)} {...props} />;
}

export function SectionHeading({ title, aside, id }: { title: string; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-heading md:text-title">
        {title}
      </h2>
      {aside && <div className="shrink-0 pb-0.5 text-label text-ink-500">{aside}</div>}
    </div>
  );
}

export function Chip({ selected, className, ...props }: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "hit-44 relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-label transition-colors duration-150",
        selected ? "border-night-900 bg-night-900 text-white" : "border-line bg-white text-ink-700 hover:bg-surface-1",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-ember-50 text-ember-700">{icon}</div>
      <h2 className="mt-5 text-heading">{title}</h2>
      <p className="mt-2 text-ink-700">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    info: "bg-surface-1 text-ink-700",
    warn: "bg-ember-50 text-ink-900",
    error: "bg-chili-50 text-chili-600",
    success: "bg-leaf-50 text-leaf-700",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md px-4 py-3 text-label", tones[tone], className)}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ forms
export const inputClass =
  "h-12 w-full rounded-md border border-line bg-white px-3.5 text-body text-ink-900 transition-colors duration-150 " +
  "hover:border-line-strong focus:border-ember-600 focus:outline-none focus:ring-2 focus:ring-ember-100 disabled:bg-surface-1 disabled:text-ink-500";

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-label text-ink-900">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-small font-medium text-chili-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-small text-ink-500">{hint}</p>
      )}
    </div>
  );
}

/** iOS-style switch built on a real checkbox. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cn("relative inline-flex h-7 w-12 shrink-0 items-center", disabled && "opacity-60")}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full bg-ink-300 transition-colors duration-150 checked:bg-leaf-600 disabled:cursor-not-allowed"
      />
      <span className="pointer-events-none absolute left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-move peer-checked:translate-x-5" />
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-5 animate-spin text-ink-500", className)} role="status" aria-label="Loading" />;
}
