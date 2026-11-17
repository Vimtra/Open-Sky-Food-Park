"use client";

import Link from "next/link";
import { AtSign, ChevronDown, ChevronLeft, MapPin, Phone, Search, Store, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageSrc, plural } from "@/lib/format";
import { useCatalog } from "@/lib/hooks";
import type { Diet } from "@/lib/types";
import { MenuItemRow, OpenStatus } from "./cards";
import { ButtonLink, Chip, cn, Container, DietMark, EmptyState, Notice } from "./ui";

const dietChips: { diet: Diet; label: string }[] = [
  { diet: "veg", label: "Veg" },
  { diet: "egg", label: "Egg" },
  { diet: "nonveg", label: "Non-veg" },
];

export function StallSkeleton() {
  return (
    <Container className="max-w-[840px] pt-14 pb-6" aria-hidden>
      <div className="skeleton -mx-4 h-56 rounded-none md:mx-0 md:h-72 md:rounded-xl" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-4 w-16" />
            </div>
            <div className="skeleton size-28 rounded-lg" />
          </div>
        ))}
      </div>
    </Container>
  );
}

export function StallScreen({ slug }: { slug: string }) {
  const { index, error } = useCatalog();
  const [query, setQuery] = useState("");
  const [diets, setDiets] = useState<Diet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const chipRow = useRef<HTMLDivElement>(null);

  const stall = index?.stallBySlug.get(slug);
  const allItems = useMemo(() => (stall && index ? (index.itemsByStall.get(stall.id) ?? []) : []), [index, stall]);
  const categories = useMemo(() => (stall && index ? (index.categoriesByStall.get(stall.id) ?? []) : []), [index, stall]);
  const dietsOnMenu = useMemo(() => dietChips.filter((d) => allItems.some((m) => m.diet === d.diet)), [allItems]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((category) => ({
        category,
        items: allItems.filter(
          (m) =>
            m.category_id === category.id &&
            (diets.length === 0 || (m.diet !== null && diets.includes(m.diet))) &&
            (!q || m.name.toLowerCase().includes(q) || category.name.toLowerCase().includes(q)),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [categories, allItems, diets, query]);

  // Jump to and briefly mark the dish named in the URL hash (links from the home page and search).
  const ready = Boolean(stall);
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center" });
      setHighlight(id);
    });
    const t = setTimeout(() => setHighlight(null), 2600);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [ready]);

  // Keep the category chip in step with the section being read.
  const sectionKey = sections.map((s) => s.category.id).join("|");
  useEffect(() => {
    if (!sectionKey) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCategory(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-180px 0px -55% 0px" },
    );
    document.querySelectorAll("[data-menu-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionKey]);

  useEffect(() => {
    if (!activeCategory) return;
    const row = chipRow.current;
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(activeCategory)}"]`);
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
  }, [activeCategory]);

  if (!index) {
    return error ? (
      <Container className="py-8">
        <Notice tone="error">We could not load this menu. Check your connection and refresh.</Notice>
      </Container>
    ) : (
      <StallSkeleton />
    );
  }

  if (!stall || !stall.is_active) {
    return (
      <EmptyState
        icon={<Store className="size-7" aria-hidden />}
        title="This stall is not at the park"
        body="It may have moved on or the link is out of date."
        action={<ButtonLink href="/">See all food trucks</ButtonLink>}
      />
    );
  }

  const filtering = Boolean(query.trim()) || diets.length > 0;

  return (
    <Container className="max-w-[840px] pb-8">
      <Link href="/" className="mt-3 -ml-1.5 inline-flex h-10 items-center gap-1 rounded-md pr-2 text-label font-bold text-ink-700 hover:text-ink-900">
        <ChevronLeft className="size-5" aria-hidden />
        All food trucks
      </Link>

      {/* Photo hero: the truck's cover photo, with its name set over a navy fade at the bottom. */}
      <header className="on-night relative isolate -mx-4 mt-1 flex min-h-56 items-end overflow-hidden bg-night-900 text-white md:mx-0 md:min-h-72 md:rounded-xl">
        {stall.cover_url && (
          <img
            src={imageSrc(stall.cover_url)!}
            alt=""
            fetchPriority="high"
            className={cn("absolute inset-0 -z-20 size-full object-cover", !stall.is_open && "grayscale")}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-t/oklch from-night-900/90 via-night-900/35 to-night-900/0"
        />
        <div className="flex w-full items-end gap-4 p-4 md:p-6">
          {stall.logo_url && (
            <img src={imageSrc(stall.logo_url)!} alt="" className="size-14 shrink-0 rounded-full border-2 border-white bg-white object-cover md:size-18" />
          )}
          <div className="min-w-0">
            <h1 className="text-title md:text-[2.5rem] md:leading-[2.875rem] md:font-extrabold md:tracking-[-0.03em]">{stall.name}</h1>
            {stall.tagline && <p className="mt-0.5 font-semibold text-white/90">{stall.tagline}</p>}
            <p className="mt-0.5 text-label font-medium text-white/75">{stall.cuisines.join(" · ")}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line py-3 text-label">
        <OpenStatus stall={stall} />
        {stall.location_label && (
          <span className="inline-flex items-center gap-1.5 text-ink-700">
            <MapPin className="size-4" aria-hidden />
            {stall.location_label}
          </span>
        )}
        {stall.phone && (
          <a href={`tel:${stall.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900 hover:underline">
            <Phone className="size-4" aria-hidden />
            {stall.phone}
          </a>
        )}
        {stall.instagram && (
          <a
            href={`https://www.instagram.com/${stall.instagram}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-ink-700 hover:text-ink-900 hover:underline"
          >
            <AtSign className="size-4" aria-hidden />
            {stall.instagram}
          </a>
        )}
      </div>

      {!stall.is_open && (
        <Notice tone="warn" className="mt-4">
          {stall.name} is closed right now, so its dishes cannot be added. You can still look through the menu.
        </Notice>
      )}

      <div className="sticky top-0 z-20 -mx-4 mt-2 border-b border-line bg-white px-4 pt-3 md:top-[4.5rem]">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search in ${stall.name}`}
              aria-label={`Search in ${stall.name}`}
              className="h-10 w-full rounded-md bg-surface-1 pr-9 pl-10 text-[0.9375rem] hover:bg-surface-2 focus:bg-white focus:ring-2 focus:ring-ember-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="hit-44 absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:bg-surface-2">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {dietsOnMenu.map(({ diet, label }) => (
            <Chip
              key={diet}
              selected={diets.includes(diet)}
              onClick={() => setDiets((d) => (d.includes(diet) ? d.filter((x) => x !== diet) : [...d, diet]))}
              className="h-10 px-3"
            >
              <DietMark diet={diet} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </Chip>
          ))}
        </div>
        <div ref={chipRow} className="no-scrollbar relative -mx-4 mt-2 flex gap-5 overflow-x-auto px-4" role="navigation" aria-label="Menu sections">
          {sections.map(({ category, items }) => {
            const active = (activeCategory ?? sections[0]?.category.id) === category.id;
            return (
              <a
                key={category.id}
                href={`#cat-${category.id}`}
                data-chip={category.id}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "shrink-0 border-b-[3px] pt-1.5 pb-2.5 text-label whitespace-nowrap transition-colors duration-150",
                  active ? "border-ember-500 font-bold text-ink-900" : "border-transparent font-semibold text-ink-500 hover:text-ink-900",
                )}
              >
                {category.name} <span className="font-medium text-ink-500 tabular-nums">{items.length}</span>
              </a>
            );
          })}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-subheading">{filtering ? "No dishes match" : "This menu is empty for now"}</p>
          {filtering && (
            <>
              <p className="mt-1 text-ink-700">Try a different word or clear the filters.</p>
              <button
                type="button"
                className="mt-4 text-label font-bold text-ember-700 hover:underline"
                onClick={() => {
                  setQuery("");
                  setDiets([]);
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        sections.map(({ category, items }) => (
          <details key={category.id} id={`cat-${category.id}`} data-menu-section open className="group scroll-mt-40 border-b-8 border-surface-1 last:border-b-0 md:scroll-mt-56">
            <summary className="flex list-none items-center justify-between gap-3 pt-6 pb-1">
              <h3 className="text-subheading font-extrabold">
                {category.name} <span className="font-semibold text-ink-500">({items.length})</span>
              </h3>
              <ChevronDown className="size-5 text-ink-700 transition-transform duration-200 ease-move group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <MenuItemRow key={item.id} item={item} stall={stall} highlighted={highlight === item.id} />
              ))}
            </ul>
          </details>
        ))
      )}

      <p className="mt-6 text-small text-ink-500">
        {plural(allItems.length, "dish", "dishes")} on this menu. Ask the stall about ingredients and allergens before you order.
      </p>
    </Container>
  );
}
