"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { lineKey, MAX_QTY, useCart, useItemQty } from "@/lib/cart";
import { useCatalog, useStallLive } from "@/lib/hooks";
import type { MenuItem } from "@/lib/types";
import { OptionsSheet } from "./options-sheet";
import { cn } from "./ui";

interface Props {
  item: MenuItem;
  /** False when the item's stall is closed. */
  stallOpen: boolean;
  className?: string;
  /** "lg" is the big button on the dish page. */
  size?: "md" | "lg";
}

/**
 * The ADD button that turns into a − qty + stepper once the item is in the cart.
 * Dishes with options (size, spice, add-ons) open the options sheet instead of adding straight away.
 */
export function AddButton({ item, stallOpen, className, size = "md" }: Props) {
  const qty = useItemQty(item.id);
  const add = useCart((s) => s.add);
  const decrement = useCart((s) => s.decrement);
  const lines = useCart((s) => s.lines);
  const { index } = useCatalog();
  const live = useStallLive();
  const [sheet, setSheet] = useState(false);

  const groups = index?.optionsByItem.get(item.id) ?? [];
  const custom = groups.length > 0;
  const status = live.status.get(item.stall_id);
  const open = stallOpen && (status ? status.accepting : true);

  const frame = cn(
    "rounded-md border border-line bg-white shadow-md font-extrabold tabular-nums",
    size === "lg" ? "h-12 w-44 text-body [&_button]:w-12" : "h-9 w-24 text-label",
  );

  if (!item.is_available || !open) {
    return (
      <span className={cn(frame, "inline-flex items-center justify-center font-semibold text-ink-500 shadow-none", className)}>
        {!item.is_available ? "Sold out" : status?.reason === "paused" ? "Busy" : "Closed"}
      </span>
    );
  }

  const plus = () => (custom ? setSheet(true) : add(item.id));
  // With options, − takes one off the most recently added line of this dish.
  const minus = () => {
    const keys = Object.keys(lines).filter((k) => lines[k].item_id === item.id);
    const key = custom ? keys[keys.length - 1] : lineKey(item.id);
    if (key) decrement(key);
  };

  return (
    <>
      {qty === 0 ? (
        <button
          type="button"
          onClick={plus}
          aria-label={custom ? `Choose options for ${item.name}` : `Add ${item.name} to cart`}
          aria-haspopup={custom ? "dialog" : undefined}
          className={cn(
            frame,
            "hit-44 tracking-wide",
            !className?.includes("absolute") && "relative",
            "text-leaf-600 transition-[background-color,scale] duration-150 ease-enter hover:bg-leaf-50 active:scale-[0.96] active:bg-leaf-50",
            custom && "leading-none",
            className,
          )}
        >
          ADD
          {custom && <span className="mt-0.5 block text-[0.625rem] font-semibold tracking-normal text-ink-500">options</span>}
        </button>
      ) : (
        <div className={cn(frame, "inline-flex items-stretch overflow-hidden text-leaf-600", className)} role="group" aria-label={`${item.name} quantity`}>
          <button
            type="button"
            onClick={minus}
            aria-label={qty === 1 ? `Remove ${item.name} from cart` : `Decrease ${item.name}`}
            className="hit-44 relative flex w-8 items-center justify-center transition-colors duration-150 hover:bg-leaf-50"
          >
            <Minus className="size-4" strokeWidth={2.75} aria-hidden />
          </button>
          <span className="flex flex-1 items-center justify-center" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            onClick={plus}
            disabled={qty >= MAX_QTY}
            aria-label={custom ? `Add another ${item.name} with options` : `Increase ${item.name}`}
            className="hit-44 relative flex w-8 items-center justify-center transition-colors duration-150 hover:bg-leaf-50 disabled:text-ink-300"
          >
            <Plus className="size-4" strokeWidth={2.75} aria-hidden />
          </button>
        </div>
      )}
      {sheet && <OptionsSheet item={item} groups={groups} onClose={() => setSheet(false)} />}
    </>
  );
}
