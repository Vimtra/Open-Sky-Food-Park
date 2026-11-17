"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_QTY, useCart } from "@/lib/cart";
import type { MenuItem } from "@/lib/types";
import { cn } from "./ui";

interface Props {
  item: MenuItem;
  /** False when the item's stall is closed. */
  stallOpen: boolean;
  className?: string;
}

/** The ADD button that turns into a − qty + stepper once the item is in the cart. */
export function AddButton({ item, stallOpen, className }: Props) {
  const qty = useCart((s) => (s.hydrated ? (s.lines[item.id] ?? 0) : 0));
  const add = useCart((s) => s.add);
  const decrement = useCart((s) => s.decrement);

  const frame = "h-9 w-24 rounded-md border border-line bg-white shadow-md text-label font-extrabold tabular-nums";

  if (!item.is_available || !stallOpen) {
    return (
      <span className={cn(frame, "inline-flex items-center justify-center font-semibold text-ink-500 shadow-none", className)}>
        {item.is_available ? "Closed" : "Sold out"}
      </span>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => add(item.id)}
        aria-label={`Add ${item.name} to cart`}
        className={cn(frame, "hit-44 tracking-wide", !className?.includes("absolute") && "relative", "text-leaf-600 transition-[background-color,scale] duration-150 ease-enter hover:bg-leaf-50 active:scale-[0.96] active:bg-leaf-50", className)}
      >
        ADD
      </button>
    );
  }

  return (
    <div className={cn(frame, "inline-flex items-stretch overflow-hidden text-leaf-600", className)} role="group" aria-label={`${item.name} quantity`}>
      <button
        type="button"
        onClick={() => decrement(item.id)}
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
        onClick={() => add(item.id)}
        disabled={qty >= MAX_QTY}
        aria-label={`Increase ${item.name}`}
        className="hit-44 relative flex w-8 items-center justify-center transition-colors duration-150 hover:bg-leaf-50 disabled:text-ink-300"
      >
        <Plus className="size-4" strokeWidth={2.75} aria-hidden />
      </button>
    </div>
  );
}
