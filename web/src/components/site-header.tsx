"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Receipt, Search, ShoppingBag, User } from "lucide-react";
import { useCartView } from "@/lib/cart";
import { useCatalog, useSession } from "@/lib/hooks";
import { OpenSkyLogo } from "./brand/open-sky-logo";
import { Container } from "./ui";

/** Night-sky header. Desktop: logo, search, nav, cart. Phones: logo and address; tabs live at the bottom. */
export function SiteHeader() {
  const router = useRouter();
  const { index } = useCatalog();
  const { session } = useSession("customer");
  const cart = useCartView();
  const park = index?.catalog.park;

  return (
    <header className="on-night bg-night-900 text-white md:sticky md:top-0 md:z-40">
      <Container className="flex h-16 items-center gap-4 md:h-[4.5rem] md:gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="block w-32 shrink-0 rounded-md md:w-36" aria-label="Open Sky Food Park, home">
            <OpenSkyLogo variant="compact" className="w-full" title="Open Sky Food Park" />
          </Link>
          <span className="hidden min-w-0 items-center gap-1 border-l border-white/15 pl-4 text-small text-night-muted lg:flex">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{park?.address ?? "Milpitas, CA"}</span>
          </span>
        </div>

        <form
          role="search"
          className="relative ml-2 hidden max-w-md flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
            router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-night-muted" aria-hidden />
          <input
            name="q"
            type="search"
            aria-label="Search dishes and stalls"
            placeholder="Search dishes and stalls"
            className="h-11 w-full rounded-md border border-white/10 bg-night-800 pr-3 pl-10 text-[0.9375rem] text-white placeholder:text-night-muted hover:border-white/25 focus:border-gold-400 focus:outline-none"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 md:gap-2" aria-label="Main">
          <Link
            href="/orders"
            className="hidden h-11 items-center gap-2 rounded-md px-3 text-label font-bold text-white hover:bg-white/10 md:inline-flex"
          >
            <Receipt className="size-4.5" aria-hidden />
            Orders
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center gap-2 rounded-md px-2.5 text-label font-bold text-white hover:bg-white/10 md:px-3"
            aria-label={session ? "Your account" : "Sign in"}
          >
            <User className="size-5 md:size-4.5" aria-hidden />
            <span className="hidden max-w-28 truncate md:inline">{session ? (session.profile.full_name?.split(" ")[0] ?? "Account") : "Sign in"}</span>
          </Link>
          <Link
            href="/cart"
            className="hidden h-11 items-center gap-2 rounded-md bg-ember-500 px-4 text-label font-extrabold text-night-900 transition-colors duration-150 hover:bg-ember-400 md:inline-flex"
          >
            <ShoppingBag className="size-4.5" aria-hidden />
            Cart
            {cart.count > 0 && (
              <span key={cart.count} className="animate-pop rounded-full bg-night-900 px-2 py-0.5 text-caption font-bold text-white tabular-nums">
                {cart.count}
              </span>
            )}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
