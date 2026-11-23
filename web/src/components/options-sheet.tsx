"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_QTY, useCart } from "@/lib/cart";
import { friendlyError, money } from "@/lib/format";
import { checkChoice, defaultChoice, priceWithOptions, ruleText, type OptionGroupView } from "@/lib/options";
import type { MenuItem } from "@/lib/types";
import { Button, cn, DietMark, inputClass } from "./ui";

interface Props {
  item: MenuItem;
  groups: OptionGroupView[];
  onClose: () => void;
}

/** Pick a dish's options (size, spice, add-ons), add a note for the truck, choose how many. */
export function OptionsSheet({ item, groups, onClose }: Props) {
  const add = useCart((s) => s.add);
  const [picked, setPicked] = useState<string[]>(() => defaultChoice(groups));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const problem = checkChoice(groups, picked, true);
  const { unit_price_cents } = priceWithOptions(item, groups, picked);

  const toggle = (g: OptionGroupView, id: string) => {
    setPicked((cur) => {
      const inGroup = new Set(g.options.map((o) => o.id));
      if (g.group.max_select === 1) return [...cur.filter((x) => !inGroup.has(x)), id];
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      const count = cur.filter((x) => inGroup.has(x)).length;
      return count >= g.group.max_select ? cur : [...cur, id];
    });
  };

  const submit = () => {
    setTried(true);
    if (problem) return;
    add(item.id, picked, qty, note);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-950/50 md:items-center md:p-6" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-xl bg-white shadow-2xl outline-none md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line p-4">
          <DietMark diet={item.diet} className="mt-1" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-subheading font-extrabold">
              {item.name}
            </h2>
            <p className="text-label text-ink-700 tabular-nums">{money(item.price_cents)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="hit-44 relative rounded-full p-1.5 text-ink-500 hover:bg-surface-1">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {groups.map((g) => {
            const count = g.options.filter((o) => picked.includes(o.id)).length;
            const short = tried && (count < g.group.min_select || count > g.group.max_select);
            const single = g.group.max_select === 1;
            return (
              <fieldset key={g.group.id}>
                <legend className="flex w-full items-baseline justify-between gap-3">
                  <span className="font-extrabold">{g.group.name}</span>
                  <span className={cn("text-small font-semibold", short ? "text-chili-600" : "text-ink-500")}>{ruleText(g.group)}</span>
                </legend>
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {g.options.map((o) => {
                    const on = picked.includes(o.id);
                    const full = !single && !on && count >= g.group.max_select;
                    return (
                      <li key={o.id}>
                        <label className={cn("flex min-h-12 items-center gap-3 px-3 py-2", o.is_available && !full ? "cursor-pointer hover:bg-surface-1" : "opacity-50")}>
                          <input
                            type={single ? "radio" : "checkbox"}
                            name={`g-${g.group.id}`}
                            checked={on}
                            disabled={!o.is_available || full}
                            onChange={() => toggle(g, o.id)}
                            className="size-4.5 accent-ember-600"
                          />
                          <span className="flex-1 text-label font-semibold">
                            {o.name}
                            {!o.is_available && <span className="ml-2 text-small font-medium text-ink-500">Sold out</span>}
                          </span>
                          {o.price_cents > 0 && <span className="text-label text-ink-700 tabular-nums">+{money(o.price_cents)}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}

          <label className="block">
            <span className="font-extrabold">Note for the truck</span> <span className="text-small text-ink-500">(optional)</span>
            <textarea
              rows={2}
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no onions"
              className={cn(inputClass, "mt-2 h-auto py-2.5")}
            />
          </label>
        </div>

        <div className="pb-safe flex items-center gap-3 border-t border-line p-4">
          <div className="inline-flex h-12 items-stretch overflow-hidden rounded-md border border-line font-extrabold text-leaf-600 tabular-nums" role="group" aria-label="Quantity">
            <button type="button" className="w-11 hover:bg-leaf-50 disabled:text-ink-300" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Fewer">
              <Minus className="mx-auto size-4" strokeWidth={2.75} aria-hidden />
            </button>
            <span className="flex w-8 items-center justify-center" aria-live="polite">
              {qty}
            </span>
            <button type="button" className="w-11 hover:bg-leaf-50 disabled:text-ink-300" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} aria-label="More">
              <Plus className="mx-auto size-4" strokeWidth={2.75} aria-hidden />
            </button>
          </div>
          <Button size="lg" className="flex-1" onClick={submit}>
            Add to cart · {money(unit_price_cents * qty)}
          </Button>
        </div>
        {tried && problem && (
          <p className="px-4 pb-4 text-small font-semibold text-chili-600" role="alert">
            {friendlyError(new Error(problem))}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
