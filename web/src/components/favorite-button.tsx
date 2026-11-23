"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/format";
import { useFavorites } from "@/lib/hooks";
import { cn } from "./ui";

interface Props {
  /** A dish or a truck. */
  target: { menu_item_id: string } | { stall_id: string };
  name: string;
  className?: string;
  /** "chip" shows the word too (stall and dish pages); "icon" is a round button for photos. */
  variant?: "icon" | "chip";
}

/** Heart that saves a dish or truck to the customer's account. Signed out, it asks to sign in. */
export function FavoriteButton({ target, name, className, variant = "icon" }: Props) {
  const fav = useFavorites();
  const router = useRouter();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const on = "menu_item_id" in target ? fav.items.has(target.menu_item_id) : fav.stalls.has(target.stall_id);

  const click = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!fav.signedIn) {
      router.push(`/account?next=${encodeURIComponent(path)}`);
      return;
    }
    setBusy(true);
    try {
      const now = await fav.toggle(target);
      setFlash(now ? "Saved to favourites" : "Removed from favourites");
    } catch (err) {
      setFlash(friendlyError(err));
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 1800);
    }
  };

  const label = on ? `Remove ${name} from favourites` : fav.signedIn ? `Save ${name} to favourites` : `Sign in to save ${name}`;
  return (
    <>
      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={cn(
          variant === "icon"
            ? cn("hit-44 inline-flex size-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm", !className?.includes("absolute") && "relative")
            : "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-label font-bold",
          "transition-[scale,background-color] duration-150 active:scale-[0.92] hover:bg-white",
          className,
        )}
      >
        <Heart className={cn("size-4.5", on ? "fill-chili-600 text-chili-600" : "text-ink-700")} strokeWidth={2.25} aria-hidden />
        {variant === "chip" && (on ? "Saved" : "Save")}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {flash}
      </span>
    </>
  );
}
