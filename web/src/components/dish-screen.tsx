"use client";

import Link from "next/link";
import { ChevronRight, Info, Store, Ticket, Armchair, UtensilsCrossed } from "lucide-react";
import { dishBlurb, imageSrc, money } from "@/lib/format";
import { useCatalog, type CatalogIndex } from "@/lib/hooks";
import type { Diet, MenuItem, Stall } from "@/lib/types";
import { AddButton } from "./add-button";
import { DishCard, OpenStatus } from "./cards";
import { FavoriteButton } from "./favorite-button";
import { Rail } from "./rail";
import { ButtonLink, Container, DietMark, EmptyState, FoodImage, Notice } from "./ui";

const dietLabel: Record<Diet, string> = { veg: "Veg", egg: "Egg", nonveg: "Non-veg" };
const RAIL_SIZE = 10;

export function DishSkeleton() {
  return (
    <Container className="py-6 md:py-8" aria-hidden>
      <div className="skeleton h-4 w-60" />
      <div className="skeleton mt-4 h-9 w-80 max-w-full" />
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        <div className="skeleton aspect-square rounded-xl md:aspect-[4/3]" />
        <div className="space-y-3">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-8 w-28" />
          <div className="skeleton h-12 w-44 rounded-md" />
        </div>
      </div>
    </Container>
  );
}

/** What to show under a dish: the rest of its menu section, the rest of its truck, then the other trucks. */
function recommendations(index: CatalogIndex, item: MenuItem, stall: Stall) {
  const usable = (m: MenuItem) => m.id !== item.id && m.is_available && Boolean(m.image_url);
  const featuredFirst = (a: MenuItem, b: MenuItem) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order;
  const own = (index.itemsByStall.get(stall.id) ?? []).filter(usable);

  const sameSection = own.filter((m) => m.category_id === item.category_id).slice(0, RAIL_SIZE);
  const shown = new Set(sameSection.map((m) => m.id));
  const sameTruck = own.filter((m) => !shown.has(m.id)).sort(featuredFirst).slice(0, RAIL_SIZE);
  const otherTrucks = index.stalls
    .filter((s) => s.id !== stall.id && s.is_active)
    .map((s) => ({ stall: s, items: (index.itemsByStall.get(s.id) ?? []).filter(usable).sort(featuredFirst).slice(0, RAIL_SIZE) }))
    .filter((g) => g.items.length > 0);
  return { sameSection, sameTruck, otherTrucks };
}

export function DishScreen({ stallSlug, dishSlug }: { stallSlug: string; dishSlug: string }) {
  const { index, error } = useCatalog();
  const stall = index?.stallBySlug.get(stallSlug);
  const item = stall && index ? index.itemById.get(`${stall.id}.${dishSlug}`) : undefined;

  if (!index) {
    return error ? (
      <Container className="py-8">
        <Notice tone="error">We could not load this dish. Check your connection and refresh.</Notice>
      </Container>
    ) : (
      <DishSkeleton />
    );
  }

  if (!stall || !stall.is_active || !item) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="size-7" aria-hidden />}
        title="We could not find this dish"
        body="It may have come off the menu, or the link is out of date."
        action={<ButtonLink href={stall ? `/stall/${stall.slug}` : "/"}>{stall ? `See ${stall.name}'s menu` : "See all food trucks"}</ButtonLink>}
      />
    );
  }

  const category = index.catalog.menu_categories.find((c) => c.id === item.category_id);
  const park = index.catalog.park;
  const { sameSection, sameTruck, otherTrucks } = recommendations(index, item, stall);
  const src = imageSrc(item.image_url);
  const orderable = item.is_available && stall.is_open;

  return (
    <>
      <Container className="pt-4 pb-2 md:pt-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex min-w-0 items-center gap-1 text-small font-medium text-ink-500">
            <li className="flex shrink-0 items-center gap-1">
              <Link href="/" className="hover:text-ink-900 hover:underline">
                Home
              </Link>
              <ChevronRight className="size-3.5" aria-hidden />
            </li>
            <li className="flex shrink-0 items-center gap-1">
              <Link href={`/stall/${stall.slug}`} className="hover:text-ink-900 hover:underline">
                {stall.name}
              </Link>
              <ChevronRight className="size-3.5" aria-hidden />
            </li>
            <li className="truncate font-semibold text-ink-900" aria-current="page">
              {item.name}
            </li>
          </ol>
        </nav>

        <h1 className="mt-3 text-title text-balance md:text-[2.25rem] md:leading-[2.625rem] md:tracking-[-0.025em]">{item.name}</h1>

        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-start md:gap-10">
          <div className="-mx-4 md:mx-0">
            {src ? (
              <FoodImage
                src={src}
                alt={item.name}
                className={`aspect-square w-full md:aspect-[4/3] md:rounded-xl ${item.is_available ? "" : "opacity-60 grayscale"}`}
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-1 text-ink-300 md:rounded-xl">
                <UtensilsCrossed className="size-12" aria-hidden />
              </div>
            )}
          </div>

          <div className="md:sticky md:top-28">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label">
              {item.diet && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
                  <DietMark diet={item.diet} />
                  {dietLabel[item.diet]}
                </span>
              )}
              {item.diet && category && <span aria-hidden className="text-ink-300">·</span>}
              {category && (
                <Link href={`/stall/${stall.slug}#cat-${category.id}`} className="font-semibold text-ink-700 hover:underline">
                  {category.name}
                </Link>
              )}
            </p>

            <p className="mt-2 text-title tabular-nums">{money(item.price_cents)}</p>
            {dishBlurb(item) && <p className="mt-2 max-w-prose text-body text-ink-700">{dishBlurb(item)}</p>}

            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-label">
              <Link href={`/stall/${stall.slug}`} className="font-bold text-ember-700 underline decoration-ember-700/40 underline-offset-4 hover:decoration-ember-700">
                {stall.name}
              </Link>
              <span aria-hidden className="text-ink-300">·</span>
              <OpenStatus stall={stall} />
            </p>
            <p className="mt-0.5 text-small text-ink-500">{stall.cuisines.join(", ")}</p>

            <div className="mt-5">
              <div className="flex items-center gap-3">
                <AddButton item={item} stallOpen={stall.is_open} size="lg" className="shadow-sm" />
                <FavoriteButton target={{ menu_item_id: item.id }} name={item.name} variant="chip" />
              </div>
              {!orderable && (
                <p className="mt-2 text-small text-ink-500">
                  {item.is_available ? `${stall.name} is closed right now.` : "This dish is sold out right now."}
                </p>
              )}
            </div>

            {/* How you get it, as a short timeline like the order flow. */}
            <ol className="mt-6 border-t border-line pt-5 text-label">
              <li className="relative flex gap-3 pb-4 pl-0.5">
                <span aria-hidden className="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-line-strong" />
                <Store className="size-5 shrink-0 text-ink-700" aria-hidden />
                <span>
                  <span className="font-bold text-ink-900">Made at </span>
                  <span className="text-ink-700">
                    {stall.name}
                    {stall.location_label ? `, ${stall.location_label}` : ""}
                  </span>
                </span>
              </li>
              <li className="flex gap-3 pl-0.5">
                {park.table_service_enabled ? <Armchair className="size-5 shrink-0 text-ink-700" aria-hidden /> : <Ticket className="size-5 shrink-0 text-ink-700" aria-hidden />}
                <span className="text-ink-700">
                  <span className="font-bold text-ink-900">Collect </span>
                  with your token at the truck{park.table_service_enabled ? ", or have it brought to your table" : ""}
                </span>
              </li>
            </ol>

            <p className="mt-5 flex gap-2 text-small text-ink-500">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              Ask the truck about ingredients and allergens before you order.
            </p>
          </div>
        </div>
      </Container>

      <Container className="space-y-10 py-10 md:space-y-14 md:py-14">
        {sameSection.length > 0 && (
          <Rail title={category ? `More ${category.name}` : `More from ${stall.name}`}>
            {sameSection.map((m) => (
              <DishCard key={m.id} item={m} stall={stall} />
            ))}
          </Rail>
        )}
        {sameTruck.length > 0 && (
          <Rail
            title={`More from ${stall.name}`}
            aside={
              <Link href={`/stall/${stall.slug}`} className="inline-flex h-9 items-center gap-0.5 rounded-md px-1 text-label font-bold text-ember-700 hover:underline">
                Full menu
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          >
            {sameTruck.map((m) => (
              <DishCard key={m.id} item={m} stall={stall} />
            ))}
          </Rail>
        )}
        {otherTrucks.map(({ stall: other, items }) => (
          <Rail
            key={other.id}
            title={`Also at the park: ${other.name}`}
            aside={
              <Link href={`/stall/${other.slug}`} className="inline-flex h-9 items-center gap-0.5 rounded-md px-1 text-label font-bold text-ember-700 hover:underline">
                Full menu
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          >
            {items.map((m) => (
              <DishCard key={m.id} item={m} stall={other} />
            ))}
          </Rail>
        ))}
      </Container>
    </>
  );
}
