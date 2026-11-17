"use client";

import Link from "next/link";
import { Armchair, ChevronRight, Search, Ticket } from "lucide-react";
import { imageSrc, money } from "@/lib/format";
import { useCatalog, type CatalogIndex } from "@/lib/hooks";
import type { MenuItem } from "@/lib/types";
import { AddButton } from "./add-button";
import { DishCard, StallCard } from "./cards";
import { Rail } from "./rail";
import { OpenSkyLogo } from "./brand/open-sky-logo";
import { Container, FoodImage, Notice, SectionHeading } from "./ui";

/** Dishes to show for a stall on the home page: photographed ones, featured first, minus those already in the promo row. */
function stallPicks(index: CatalogIndex, stallId: string, exclude: Set<string>): MenuItem[] {
  return (index.itemsByStall.get(stallId) ?? [])
    .filter((m) => m.image_url && !exclude.has(m.id))
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
    .slice(0, 10);
}

function HomeSkeleton() {
  return (
    <Container className="space-y-10 py-8" aria-hidden>
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton size-20 shrink-0 rounded-full md:size-24" />
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton aspect-[3/2] rounded-lg" />
        ))}
      </div>
    </Container>
  );
}

export function HomeScreen() {
  const { index, error } = useCatalog();
  const park = index?.catalog.park;
  const openCount = index?.stalls.filter((s) => s.is_open).length ?? 0;
  const banners = index?.catalog.banners.filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order) ?? [];
  const bannerItemIds = new Set(banners.map((b) => b.menu_item_id).filter((x): x is string => Boolean(x)));

  return (
    <>
      <section className="on-night relative isolate overflow-hidden bg-night-900 text-white">
        {/* AI-generated night view of a food truck park (owner to approve). The scrim keeps the text readable. */}
        <img
          src="/hero/park-night.jpg"
          srcSet="/hero/park-night-1280.jpg 1280w, /hero/park-night.jpg 2400w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 size-full object-cover object-[72%_center]"
        />
        <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
        <Container className="flex min-h-[23rem] flex-col justify-end pt-16 pb-7 md:min-h-[30rem] md:justify-center md:py-16">
          <OpenSkyLogo variant="full" animate className="w-64 md:w-[22rem]" title={park?.name ?? "Open Sky Food Park"} />
          <h1 className="mt-6 max-w-xl text-title md:text-[2.75rem] md:leading-[3.125rem] md:font-extrabold md:tracking-[-0.03em]">
            Order from every truck at Open Sky
          </h1>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-6 text-white/80 md:text-body">
            One cart across all the stalls. Pay once, then collect each dish with your token or have it brought to your table.
          </p>
          {index && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="At the park now">
              <li className="hero-pill">
                <span className={openCount > 0 ? "size-2 rounded-full bg-leaf-600 ring-2 ring-leaf-600/30" : "size-2 rounded-full bg-ink-300"} aria-hidden />
                {openCount === index.stalls.length ? `All ${openCount} trucks open` : `${openCount} of ${index.stalls.length} trucks open`}
              </li>
              <li className="hero-pill">
                <Ticket className="size-4" aria-hidden />
                Pickup with a token
              </li>
              {park?.table_service_enabled && (
                <li className="hero-pill">
                  <Armchair className="size-4" aria-hidden />
                  Table service
                </li>
              )}
            </ul>
          )}
          <Link
            href="/search"
            className="mt-6 flex h-12 items-center gap-3 rounded-md bg-white px-4 text-[0.9375rem] font-medium text-ink-500 shadow-lg md:hidden"
          >
            <Search className="size-5 text-ink-700" aria-hidden />
            Search dishes and stalls
          </Link>
        </Container>
      </section>

      {error && !index && (
        <Container className="py-8">
          <Notice tone="error">We could not load the menu. Check your connection and refresh.</Notice>
        </Container>
      )}
      {!index && !error && <HomeSkeleton />}

      {index && park && (
        <Container className="space-y-10 py-7 md:space-y-14 md:py-10">
          {park.announcement && <Notice tone="warn">{park.announcement}</Notice>}
          {!park.ordering_enabled && <Notice tone="warn">The park is not taking online orders right now. You can still browse the menus.</Notice>}

          {index.catalog.cravings.length > 0 && (
            <Rail title="What's on your mind?" gapClass="gap-4 md:gap-7">
              {[...index.catalog.cravings]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((c) => (
                  <Link key={c.slug} href={`/search?craving=${c.slug}`} className="group w-20 text-center md:w-28">
                    <FoodImage
                      src={imageSrc(c.image_url)}
                      alt=""
                      className="size-20 rounded-full transition-transform duration-300 ease-enter group-hover:scale-105 md:size-28"
                    />
                    <span className="mt-2 block text-small leading-4 font-semibold text-ink-700 md:text-label">{c.name}</span>
                  </Link>
                ))}
            </Rail>
          )}

          <section aria-labelledby="stalls-heading">
            <SectionHeading
              id="stalls-heading"
              title="Food trucks at Open Sky"
              aside={openCount === index.stalls.length ? `All ${index.stalls.length} open` : `${openCount} of ${index.stalls.length} open`}
            />
            <div className="mt-4 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {index.stalls.map((stall) => (
                <StallCard key={stall.id} stall={stall} itemCount={index.itemsByStall.get(stall.id)?.length ?? 0} />
              ))}
            </div>
          </section>

          {banners.length > 0 && (
            <Rail title="Combos and specials">
              {banners.map((b) => {
                const item = b.menu_item_id ? index.itemById.get(b.menu_item_id) : undefined;
                const stall = b.stall_id ? index.stallById.get(b.stall_id) : undefined;
                const href = stall ? `/stall/${stall.slug}${item ? `#${item.id}` : ""}` : "/";
                return (
                  <article key={b.id} className="w-60 md:w-64">
                    <Link href={href} className="block overflow-hidden rounded-lg" tabIndex={-1} aria-hidden>
                      <FoodImage src={imageSrc(b.image_url)} alt="" className="aspect-square w-full" />
                    </Link>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-label leading-[1.2rem] font-bold">
                          <Link href={href} className="hover:underline">
                            {b.title}
                          </Link>
                        </h3>
                        <p className="mt-0.5 truncate text-small text-ink-500">
                          {b.subtitle}
                          {item && <span className="font-semibold text-ink-900 tabular-nums"> · {money(item.price_cents)}</span>}
                        </p>
                      </div>
                      {item && stall && <AddButton item={item} stallOpen={stall.is_open} className="w-20 shadow-sm" />}
                    </div>
                  </article>
                );
              })}
            </Rail>
          )}

          {index.stalls.map((stall) => {
            const picks = stallPicks(index, stall.id, bannerItemIds);
            if (picks.length < 3) return null;
            return (
              <Rail
                key={stall.id}
                title={`From ${stall.name}`}
                aside={
                  <Link href={`/stall/${stall.slug}`} className="inline-flex h-9 items-center gap-0.5 rounded-md px-1 text-label font-bold text-ember-700 hover:underline">
                    Full menu
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                }
              >
                {picks.map((item) => (
                  <DishCard key={item.id} item={item} stall={stall} />
                ))}
              </Rail>
            );
          })}
        </Container>
      )}
    </>
  );
}
