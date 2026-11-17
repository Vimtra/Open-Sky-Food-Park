"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { imageSrc, money } from "@/lib/format";
import { useCatalog, type CatalogIndex } from "@/lib/hooks";
import type { MenuItem } from "@/lib/types";
import { AddButton } from "./add-button";
import { DishCard, dishHref, TruckCard } from "./cards";
import { Rail } from "./rail";
import { OpenSkyLogo } from "./brand/open-sky-logo";
import { ScrollVideo } from "./home/scroll-video";
import { buttonClass, Container, FoodImage, Notice, SectionHeading } from "./ui";

/** Dishes to show for a stall on the home page: photographed ones, featured first, minus those already in the promo row. */
function stallPicks(index: CatalogIndex, stallId: string, exclude: Set<string>): MenuItem[] {
  return (index.itemsByStall.get(stallId) ?? [])
    .filter((m) => m.image_url && !exclude.has(m.id))
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
    .slice(0, 10);
}

/** Sets data-inview on the element the first time a third of it is on screen. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.33 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return { ref, inView };
}

/** Short clips of real menu dishes. Each tile names the dish, its truck and price, and adds it to the cart. */
const REELS = [
  { itemId: "pandemkodi-dhaba.fresh-live-pulka", video: "pulka" },
  { itemId: "pandemkodi-dhaba.dhaba-chicken-curry", video: "curry" },
  { itemId: "desi-desserts.royal-falooda", video: "falooda" },
];

function DishReels({ index }: { index: CatalogIndex }) {
  const reels = REELS.flatMap(({ itemId, video }) => {
    const item = index.itemById.get(itemId);
    const stall = item && index.stallById.get(item.stall_id);
    return item && stall ? [{ item, stall, video }] : [];
  });
  if (reels.length === 0) return null;
  return (
    <section aria-labelledby="reels-heading">
      <SectionHeading id="reels-heading" title="Fresh off the trucks" />
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
        {reels.map(({ item, stall, video }) => {
          const href = dishHref(stall, item);
          return (
            <article key={item.id} className="relative isolate aspect-[4/5] w-[72%] shrink-0 snap-start overflow-hidden rounded-xl bg-night-900 sm:w-[46%] md:w-auto">
              <img src={`/video/${video}-poster.jpg`} alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover" />
              <ScrollVideo src={`/video/${video}.mp4`} className="absolute inset-0 -z-20 size-full" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t/oklch from-night-900/90 via-night-900/15 via-45% to-night-900/0" />
              <div className="on-night absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white md:p-5">
                <div className="min-w-0">
                  <h3 className="text-subheading md:text-heading">
                    <Link href={href} className="hover:underline">
                      {item.name}
                    </Link>
                  </h3>
                  <p className="mt-0.5 truncate text-small text-white/80">
                    {stall.name} · <span className="font-semibold text-white tabular-nums">{money(item.price_cents)}</span>
                  </p>
                </div>
                <AddButton item={item} stallOpen={stall.is_open} className="w-20 shrink-0" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks({ tableService }: { tableService: boolean }) {
  const { ref, inView } = useInView<HTMLElement>();
  const steps = [
    { title: "Fill one cart", body: "Add dishes from any truck." },
    { title: "Pay once", body: "One checkout for the whole order." },
    {
      title: "Collect with your token",
      body: tableService ? "Each truck gives you a token. Pick up, or have it brought to your table." : "Each truck gives you a token. Pick up when it's ready.",
    },
  ];
  return (
    <section
      ref={ref}
      data-inview={inView ? "" : undefined}
      aria-labelledby="how-heading"
      className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-12"
    >
      <h2 id="how-heading" className="reveal-item text-title md:text-[2.5rem] md:leading-[2.75rem] md:tracking-[-0.03em]">
        How it <br className="hidden md:block" />
        works
      </h2>
      <ol className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {steps.map((s, i) => (
          <li key={s.title} className="reveal-item flex items-center gap-3" style={{ "--i": i + 1 } as CSSProperties}>
            <span className="step-num" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-subheading md:text-heading">{s.title}</h3>
              <p className="mt-0.5 text-small text-ink-500 md:text-label md:font-normal">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeScreen() {
  const { index, error } = useCatalog();
  const park = index?.catalog.park;
  const banners = index?.catalog.banners.filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order) ?? [];
  const bannerItemIds = new Set(banners.map((b) => b.menu_item_id).filter((x): x is string => Boolean(x)));

  return (
    <>
      <section aria-label="Welcome">
        <div className="on-night relative isolate overflow-hidden bg-night-900 text-white">
          {/* AI-generated night view of a food truck park (owner to approve). The scrim keeps the text readable. */}
          <img
            src="/hero/park-night.jpg"
            srcSet="/hero/park-night-1280.jpg 1280w, /hero/park-night.jpg 2400w"
            sizes="100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-20 size-full object-cover object-[60%_center]"
          />
          {/* The same night scene, alive: string lights, palms, people. Plays forward then back so the loop has no seam. */}
          <ScrollVideo src="/video/park-night.mp4" eager className="absolute inset-0 -z-20 size-full object-[60%_center]" />
          <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
          <Container className="flex min-h-[27rem] flex-col items-center pt-10 pb-28 text-center md:min-h-[36rem] md:pt-14 md:pb-36">
            <OpenSkyLogo variant="full" animate className="w-64 md:w-[24rem]" title={park?.name ?? "Open Sky Food Park"} />
            <h1 className="mt-5 text-[2rem] leading-[2.375rem] font-extrabold tracking-[-0.03em] text-balance md:mt-6 md:text-[3.5rem] md:leading-[3.75rem]">
              Every truck. One cart.
            </h1>
            <p className="mt-3 max-w-md text-[0.9375rem] leading-6 text-pretty text-white/85 md:text-body">
              Order from every truck at the park, pay once, then pick up with your token
              {park?.table_service_enabled ? " or have it brought to your table" : ""}.
            </p>
            <a href="#trucks" className={buttonClass("primary", "lg", "mt-6 shadow-[0_8px_24px_-6px_oklch(72.4%_0.187_48.9/0.6)]")}>
              Start your order
            </a>
          </Container>
        </div>

        <Container id="trucks" className="relative -mt-20 scroll-mt-24 md:-mt-24">
          {index ? (
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              {index.stalls.map((stall) => (
                <TruckCard key={stall.id} stall={stall} itemCount={index.itemsByStall.get(stall.id)?.length ?? 0} />
              ))}
            </div>
          ) : (
            !error && (
              <div className="grid gap-4 md:grid-cols-2 md:gap-6" aria-hidden>
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-44 rounded-xl md:h-52" />
                ))}
              </div>
            )
          )}
        </Container>
      </section>

      {error && !index && (
        <Container className="py-8">
          <Notice tone="error">We could not load the menu. Check your connection and refresh.</Notice>
        </Container>
      )}

      {index && park && (
        <Container className="space-y-12 py-9 md:space-y-16 md:py-14">
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

          <HowItWorks tableService={park.table_service_enabled} />

          <DishReels index={index} />

          {banners.length > 0 && (
            <Rail title="Combos and specials">
              {banners.map((b) => {
                const item = b.menu_item_id ? index.itemById.get(b.menu_item_id) : undefined;
                const stall = b.stall_id ? index.stallById.get(b.stall_id) : undefined;
                const href = stall ? (item ? dishHref(stall, item) : `/stall/${stall.slug}`) : "/";
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
