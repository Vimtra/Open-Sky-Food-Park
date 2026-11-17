"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, House, Receipt, Search, ShoppingBag, User } from "lucide-react";
import { useCartView } from "@/lib/cart";
import { money, plural } from "@/lib/format";
import { cn } from "./ui";

const tabs = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/stall") },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/cart", label: "Cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") },
  { href: "/orders", label: "Orders", icon: Receipt, match: (p: string) => p.startsWith("/orders") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") },
];

function Tabs({ path }: { path: string }) {
  const cart = useCartView();
  return (
    <nav aria-label="Sections" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white md:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-caption font-semibold transition-colors duration-150",
                  active ? "text-ember-700" : "text-ink-500",
                )}
              >
                <span className="relative">
                  <Icon className="size-[1.375rem]" strokeWidth={active ? 2.5 : 2.25} aria-hidden />
                  {href === "/cart" && cart.count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4.5 rounded-full bg-ember-500 px-1 text-center text-[0.6875rem] leading-[1.125rem] font-bold text-night-900 tabular-nums">
                      {cart.count}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Floating "View cart" bar shown on phones while browsing with items in the cart. */
function CartBar({ path }: { path: string }) {
  const cart = useCartView();
  const browsing = path === "/" || path.startsWith("/stall") || path.startsWith("/search");
  if (!browsing || cart.count === 0) return null;
  const stalls = cart.groups.length;
  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3 md:hidden">
      <Link
        href="/cart"
        className="animate-sheet-up pointer-events-auto mx-auto mb-3 flex h-14 max-w-lg items-center justify-between rounded-lg bg-ember-500 px-4 text-night-900 shadow-lg transition-colors duration-150 active:bg-ember-600"
      >
        <span>
          <span key={cart.count} className="animate-pop block origin-left text-[0.9375rem] leading-5 font-extrabold tabular-nums">
            {plural(cart.count, "item")} · {money(cart.item_total_cents)}
          </span>
          <span className="block text-caption font-semibold text-night-900/75">{stalls > 1 ? `From ${stalls} stalls, one checkout` : `From ${cart.groups[0].stall.name}`}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[0.9375rem] font-extrabold">
          View cart
          <ArrowRight className="size-4.5" strokeWidth={2.5} aria-hidden />
        </span>
      </Link>
    </div>
  );
}

function WithPath() {
  const path = usePathname();
  return (
    <>
      <CartBar path={path} />
      <Tabs path={path} />
    </>
  );
}

/** Phone navigation. The path is read under Suspense so routes with params can still prerender their shell. */
export function BottomNav() {
  return (
    <Suspense fallback={<Tabs path="" />}>
      <WithPath />
    </Suspense>
  );
}
