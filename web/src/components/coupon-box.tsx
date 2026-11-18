"use client";

import { Check, TicketPercent, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { backend } from "@/lib/backend";
import { couponValueLabel, money } from "@/lib/format";
import type { CouponQuote } from "@/lib/types";
import { Button, cn, inputClass } from "./ui";

interface Props {
  /** Code the customer applied, kept by the cart. */
  code: string | null;
  quote: CouponQuote | undefined;
  /** Why the applied code no longer works (the cart changed, it expired…). */
  quoteError: string | null;
  checking: boolean;
  onApply: (code: string) => Promise<string | null>;
  onRemove: () => void;
}

/** Coupon entry for the cart: type a code, or pick one the park lists under Offers. */
export function CouponBox({ code, quote, quoteError, checking, onApply, onRemove }: Props) {
  const { data: offers } = useSWR("coupons:offers", () => backend().listOffers(), { revalidateOnFocus: false });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (value: string) => {
    const c = value.trim().toUpperCase();
    if (!c) {
      setError("Enter a code.");
      return;
    }
    setBusy(c);
    setError(null);
    const problem = await onApply(c);
    setBusy(null);
    if (problem) setError(problem);
    else setInput("");
  };

  if (code && quote && !quoteError) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-leaf-600/40 bg-leaf-50 p-3" role="status">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white">
          <Check className="size-4.5" strokeWidth={3} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-label font-extrabold text-leaf-700">{quote.code} applied</span>
          <span className="block text-small font-medium text-ink-700">
            You save <strong className="tabular-nums">{money(quote.discount_cents)}</strong> · {quote.title}
          </span>
        </span>
        <button type="button" onClick={onRemove} aria-label="Remove coupon" className="hit-44 relative rounded-full p-1.5 text-ink-500 hover:bg-white">
          <X className="size-4.5" aria-hidden />
        </button>
      </div>
    );
  }

  const listed = (offers ?? []).filter((o) => o.code !== code);

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void apply(input);
        }}
      >
        <label htmlFor="coupon-code" className="sr-only">
          Coupon code
        </label>
        <div className="relative min-w-0 flex-1">
          <TicketPercent className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            id="coupon-code"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="Coupon code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={cn(inputClass, "h-11 pl-9 font-semibold tracking-wide uppercase placeholder:normal-case placeholder:tracking-normal")}
          />
        </div>
        <Button type="submit" variant="outline" className="h-11" loading={busy === input.trim().toUpperCase() && !!input}>
          Apply
        </Button>
      </form>

      {(error || (code && quoteError)) && (
        <p className="mt-2 text-small font-semibold text-chili-600" role="alert">
          {code && quoteError ? `${code}: ${quoteError}` : error}
          {code && quoteError && (
            <button type="button" onClick={onRemove} className="ml-2 font-bold underline">
              Remove
            </button>
          )}
        </p>
      )}
      {checking && <p className="mt-2 text-small text-ink-500">Checking {code}…</p>}

      {listed.length > 0 && (
        <div className="mt-4">
          <p className="text-label font-bold text-ink-900">Offers</p>
          <ul className="mt-2 space-y-2">
            {listed.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-md border border-dashed border-line-strong p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-extrabold">{o.title}</span>
                  <span className="block text-small text-ink-500">
                    <span className="font-mono font-bold text-ink-700">{o.code}</span> · {couponValueLabel(o)}
                    {o.min_order_cents > 0 && ` on ${money(o.min_order_cents)}+`}
                  </span>
                  {o.description && <span className="block text-small text-ink-500">{o.description}</span>}
                </span>
                <Button size="sm" variant="ghost" className="text-ember-700" loading={busy === o.code} onClick={() => void apply(o.code)}>
                  Apply
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
