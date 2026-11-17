"use client";

import Link from "next/link";
import { useCatalog } from "@/lib/hooks";
import { isDemo } from "@/lib/backend";
import { OpenSkyLogo } from "./brand/open-sky-logo";
import { Container } from "./ui";

export function DemoNotice() {
  if (!isDemo) return null;
  return (
    <div className="border-b border-ember-100 bg-ember-50 text-ink-900">
      <Container className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-small">
        <span className="rounded-full bg-ember-500 px-2 py-0.5 text-caption font-bold text-night-900">Demo data</span>
        <span>
          Orders stay in this browser and no card is charged. PandemKodi Dhaba prices are placeholders until the owner confirms them.
        </span>
      </Container>
    </div>
  );
}

export function SiteFooter() {
  const { index } = useCatalog();
  const park = index?.catalog.park;
  return (
    <footer className="on-night mt-16 bg-night-900 pb-24 text-night-muted md:pb-0">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:py-12">
        <div>
          <OpenSkyLogo variant="full" className="w-60" title={park?.name ?? "Open Sky Food Park"} />
          {park?.address && <p className="mt-4 text-label font-medium">{park.address}</p>}
        </div>
        <nav aria-label="Order">
          <p className="text-label text-white">Order</p>
          <ul className="mt-3 space-y-2.5 text-label font-medium">
            <li>
              <Link href="/" className="hover:text-white">
                Food trucks
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-white">
                Your orders
              </Link>
            </li>
            {park?.instagram && (
              <li>
                <a href={`https://www.instagram.com/${park.instagram}/`} target="_blank" rel="noreferrer" className="hover:text-white">
                  Instagram @{park.instagram}
                </a>
              </li>
            )}
          </ul>
        </nav>
        <nav aria-label="For the park">
          <p className="text-label text-white">For the park</p>
          <ul className="mt-3 space-y-2.5 text-label font-medium">
            <li>
              <Link href="/partner" className="hover:text-white">
                Stall dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-white">
                Admin panel
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
