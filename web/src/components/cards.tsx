"use client";

import Link from "next/link";
import { imageSrc, money } from "@/lib/format";
import type { MenuItem, Stall } from "@/lib/types";
import { AddButton } from "./add-button";
import { cn, DietMark, FoodImage } from "./ui";

export function OpenStatus({ stall, className }: { stall: Pick<Stall, "is_open">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", stall.is_open ? "text-leaf-600" : "text-ink-500", className)}>
      <span className={cn("size-2 rounded-full", stall.is_open ? "bg-leaf-600" : "bg-ink-300")} aria-hidden />
      {stall.is_open ? "Open now" : "Closed"}
    </span>
  );
}

/** Stall tile for the home grid: cover photo, logo, name, what it serves, whether it is open. */
export function StallCard({ stall, itemCount }: { stall: Stall; itemCount: number }) {
  return (
    <Link href={`/stall/${stall.slug}`} className="group block rounded-lg">
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-surface-1">
        <FoodImage
          src={imageSrc(stall.cover_url)}
          alt=""
          className={cn("size-full transition-transform duration-300 ease-enter group-hover:scale-[1.04]", !stall.is_open && "opacity-60 grayscale")}
        />
        {stall.logo_url && (
          <img
            src={imageSrc(stall.logo_url)!}
            alt=""
            className="absolute bottom-3 left-3 size-14 rounded-full border-2 border-white bg-white object-cover shadow-md"
          />
        )}
        {!stall.is_open && (
          <span className="absolute top-3 left-3 rounded-full bg-night-900 px-3 py-1 text-caption font-bold text-white">Closed right now</span>
        )}
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="truncate text-subheading">{stall.name}</h3>
        <p className="truncate text-label font-medium text-ink-500">{stall.cuisines.join(" · ")}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-small text-ink-700">
          <OpenStatus stall={stall} />
          {stall.avg_prep_mins && (
            <>
              <span aria-hidden>·</span>
              <span>About {stall.avg_prep_mins} min</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{itemCount} dishes</span>
        </p>
      </div>
    </Link>
  );
}

/** Photo-led dish tile used in rails and search results. */
export function DishCard({ item, stall, showStall = false, className }: { item: MenuItem; stall: Stall; showStall?: boolean; className?: string }) {
  return (
    <article className={cn("flex w-40 flex-col md:w-44", className)}>
      <div className="relative">
        <Link href={`/stall/${stall.slug}#${item.id}`} className="block overflow-hidden rounded-lg" tabIndex={-1} aria-hidden>
          <FoodImage src={imageSrc(item.image_url)} alt="" className={cn("aspect-square w-full", !item.is_available && "opacity-50 grayscale")} />
        </Link>
        <AddButton item={item} stallOpen={stall.is_open} className="absolute right-2 -bottom-3" />
      </div>
      <div className="mt-5 flex items-start gap-1.5">
        <DietMark diet={item.diet} className="mt-0.5" />
        <h3 className="line-clamp-2 text-label leading-[1.2rem] font-bold text-ink-900">
          <Link href={`/stall/${stall.slug}#${item.id}`} className="hover:underline">
            {item.name}
          </Link>
        </h3>
      </div>
      {showStall && <p className="mt-0.5 truncate text-small text-ink-500">{stall.name}</p>}
      <p className="mt-1 text-label font-bold text-ink-900 tabular-nums">{money(item.price_cents)}</p>
    </article>
  );
}

/** One line of a stall's menu: name, price, note on the left; photo with the ADD button on the right. */
export function MenuItemRow({ item, stall, highlighted }: { item: MenuItem; stall: Stall; highlighted?: boolean }) {
  const src = imageSrc(item.image_url);
  return (
    <li
      id={item.id}
      className={cn(
        "flex scroll-mt-40 items-start justify-between gap-4 py-5 transition-colors duration-700",
        highlighted && "-mx-3 rounded-lg bg-ember-50 px-3",
      )}
    >
      <div className={cn("min-w-0 flex-1", !item.is_available && "opacity-60")}>
        <DietMark diet={item.diet} />
        <h4 className="mt-1 text-[1.0625rem] leading-6 font-bold text-ink-900">{item.name}</h4>
        <p className="mt-0.5 text-[0.9375rem] font-semibold text-ink-900 tabular-nums">{money(item.price_cents)}</p>
        {item.description && <p className="mt-2 max-w-prose text-label font-normal text-ink-500">{item.description}</p>}
      </div>
      {src ? (
        <div className="relative shrink-0 pb-3">
          <FoodImage src={src} alt={item.name} className={cn("size-28 rounded-lg md:h-32 md:w-36", !item.is_available && "opacity-50 grayscale")} />
          <AddButton item={item} stallOpen={stall.is_open} className="absolute bottom-0 left-1/2 -translate-x-1/2" />
        </div>
      ) : (
        <AddButton item={item} stallOpen={stall.is_open} className="mt-1 shrink-0" />
      )}
    </li>
  );
}
