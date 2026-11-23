"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { backend } from "@/lib/backend";
import { friendlyError } from "@/lib/format";
import type { OrderRating, StallOrder } from "@/lib/types";
import { Button, cn, inputClass } from "./ui";

const words = ["", "Poor", "Not great", "Okay", "Good", "Loved it"];

/** Stars and a comment for one truck's part of an order, after pickup. Rating again updates it. */
export function RateTruck({ so, existing, onSaved }: { so: StallOrder; existing: OrderRating | undefined; onSaved: () => void }) {
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [open, setOpen] = useState(!existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = so.stall?.name ?? "this truck";
  const shown = hover || stars;

  if (existing && !open) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3 text-label">
        <span className="font-bold">Your rating</span>
        <span className="inline-flex" aria-label={`${existing.stars} of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-4", n <= existing.stars ? "fill-ember-500 text-ember-500" : "text-ink-300")} aria-hidden />
          ))}
        </span>
        {existing.comment && <span className="text-ink-700">“{existing.comment}”</span>}
        <button type="button" className="font-bold text-ember-700 hover:underline" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
    );
  }

  const save = async () => {
    if (!stars) {
      setError("Tap a star first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await backend().rateStallOrder(so.id, stars, comment.trim() || null);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="mt-4 border-t border-line/70 pt-3">
      <legend className="pt-3 text-label font-bold">How was {name}?</legend>
      <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}: ${words[n]}`}
            aria-pressed={stars === n}
            className="hit-44 relative rounded p-1 transition-[scale] duration-150 active:scale-90"
            onMouseEnter={() => setHover(n)}
            onClick={() => setStars(n)}
          >
            <Star className={cn("size-7", n <= shown ? "fill-ember-500 text-ember-500" : "text-ink-300")} strokeWidth={1.75} aria-hidden />
          </button>
        ))}
        <span className="ml-2 text-label font-semibold text-ink-700">{words[shown]}</span>
      </div>
      {stars > 0 && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything to tell the truck? (optional)"
            aria-label={`Comment for ${name}`}
            className={cn(inputClass, "h-10 flex-1")}
          />
          <Button size="sm" className="h-10" loading={busy} onClick={save}>
            {existing ? "Update" : "Send rating"}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-small font-semibold text-chili-600">{error}</p>}
    </fieldset>
  );
}
