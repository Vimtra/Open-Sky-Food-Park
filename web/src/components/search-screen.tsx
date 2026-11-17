"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { imageSrc } from "@/lib/format";
import { useCatalog } from "@/lib/hooks";
import type { MenuItem, Stall } from "@/lib/types";
import { DishCard, OpenStatus } from "./cards";
import { Chip, Container, Notice } from "./ui";

export function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { index, error } = useCatalog();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const craving = params.get("craving");

  // Follow the URL when it changes underneath us (header search on desktop, back button).
  const urlQuery = params.get("q") ?? "";
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== query.trim()) setQuery(urlQuery);
  }

  const setUrl = (next: { q?: string; craving?: string | null }) => {
    const sp = new URLSearchParams();
    const q = next.q ?? query;
    const c = next.craving === undefined ? craving : next.craving;
    if (q.trim()) sp.set("q", q.trim());
    if (c) sp.set("craving", c);
    const qs = sp.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!index || (!q && !craving)) return null;
    const categoryName = new Map(index.catalog.menu_categories.map((c) => [c.id, c.name.toLowerCase()]));
    const groups: { stall: Stall; items: MenuItem[] }[] = [];
    for (const stall of index.stalls) {
      const stallHit = q && (stall.name.toLowerCase().includes(q) || stall.cuisines.some((c) => c.toLowerCase().includes(q)));
      const items = (index.itemsByStall.get(stall.id) ?? []).filter(
        (m) =>
          (!craving || m.craving === craving) &&
          (!q || stallHit || m.name.toLowerCase().includes(q) || (categoryName.get(m.category_id) ?? "").includes(q)),
      );
      if (items.length) groups.push({ stall, items });
    }
    return groups;
  }, [index, q, craving]);

  const cravings = index ? [...index.catalog.cravings].sort((a, b) => a.sort_order - b.sort_order) : [];
  const cravingName = cravings.find((c) => c.slug === craving)?.name;
  const total = results?.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <Container className="py-5 md:py-8">
      <h1 className="sr-only">Search</h1>
      <div className="relative mx-auto max-w-2xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          autoFocus={!craving && !urlQuery}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setUrl({ q: e.target.value });
          }}
          placeholder="Search dishes and stalls"
          aria-label="Search dishes and stalls"
          className="h-13 w-full rounded-md border border-line bg-white pr-12 pl-12 text-body font-medium hover:border-line-strong focus:border-ember-600 focus:ring-2 focus:ring-ember-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setUrl({ q: "" });
            }}
            className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:bg-surface-1"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {cravings.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-auto md:max-w-2xl md:flex-wrap md:px-0">
          {cravings.map((c) => (
            <Chip key={c.slug} selected={c.slug === craving} onClick={() => setUrl({ craving: c.slug === craving ? null : c.slug })}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {error && !index && (
        <Notice tone="error" className="mt-6">
          We could not load the menus. Check your connection and refresh.
        </Notice>
      )}

      <div className="mt-8" aria-live="polite">
        {!results && index && (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-heading">Browse by stall</h2>
            <ul className="mt-2 divide-y divide-line">
              {index.stalls.map((stall) => (
                <li key={stall.id}>
                  <StallLink stall={stall} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {results && results.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-heading">Nothing matches {q ? `“${query.trim()}”` : cravingName}</p>
            <p className="mt-1 text-ink-700">Check the spelling, or pick one of the categories above.</p>
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <h2 className="text-heading md:text-title">
              {cravingName && !q ? cravingName : `Results for “${query.trim()}”`}{" "}
              <span className="text-label font-semibold text-ink-500">
                {total} {total === 1 ? "dish" : "dishes"}
              </span>
            </h2>
            <div className="mt-2 space-y-8">
              {results.map(({ stall, items }) => (
                <section key={stall.id} aria-label={stall.name}>
                  <StallLink stall={stall} />
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {items.map((item) => (
                      <DishCard key={item.id} item={item} stall={stall} className="w-full md:w-full" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}

function StallLink({ stall }: { stall: Stall }) {
  return (
    <Link href={`/stall/${stall.slug}`} className="group flex items-center gap-3 rounded-md py-3">
      {stall.logo_url && <img src={imageSrc(stall.logo_url)!} alt="" className="size-11 rounded-full border border-line bg-white object-cover" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold group-hover:underline">{stall.name}</span>
        <span className="flex items-center gap-2 text-small text-ink-500">
          <OpenStatus stall={stall} />
          <span className="truncate">{stall.cuisines.join(" · ")}</span>
        </span>
      </span>
      <ChevronRight className="size-5 text-ink-500" aria-hidden />
    </Link>
  );
}
