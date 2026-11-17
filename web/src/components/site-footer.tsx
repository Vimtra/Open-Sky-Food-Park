"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
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

/** Instagram's camera glyph (lucide no longer ships brand icons). Stroke matches the label weight beside it. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

const linkClass = "inline-flex items-center gap-1.5 rounded-xs transition-colors duration-150 hover:text-white";

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-label font-bold text-white">{title}</h2>
      <ul className="mt-3 space-y-2.5 text-label font-medium">{children}</ul>
    </nav>
  );
}

export function SiteFooter() {
  const { index } = useCatalog();
  const park = index?.catalog.park;
  const stalls = index?.stalls.filter((s) => s.is_active) ?? [];
  // Real accounts only: the park's and any truck that has one in the catalog.
  const socials = [
    ...(park?.instagram ? [{ handle: park.instagram, owner: park.name }] : []),
    ...stalls.filter((s) => s.instagram).map((s) => ({ handle: s.instagram!, owner: s.name })),
  ];
  const directions = park?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${park.name}, ${park.address}`)}` : null;

  return (
    <footer className="on-night mt-16 bg-night-900 pb-24 text-night-muted md:pb-0">
      <Container className="grid gap-x-8 gap-y-9 py-10 sm:grid-cols-3 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:py-14">
        <div className="sm:col-span-3 md:col-span-1">
          <OpenSkyLogo variant="full" className="w-56 md:w-60" title={park?.name ?? "Open Sky Food Park"} />
          {park?.address && <p className="mt-4 text-label font-medium">{park.address}</p>}
        </div>

        <FooterColumn title="Company">
          <li>
            <Link href="/" className={linkClass}>
              Home
            </Link>
          </li>
          <li>
            <Link href="/search" className={linkClass}>
              Search dishes
            </Link>
          </li>
          <li>
            <Link href="/orders" className={linkClass}>
              Your orders
            </Link>
          </li>
          <li>
            <Link href="/contact" className={linkClass}>
              Contact us
            </Link>
          </li>
          <li>
            <Link href="/help" className={linkClass}>
              Help &amp; Support
            </Link>
          </li>
          {directions && (
            <li>
              <a href={directions} target="_blank" rel="noreferrer" className={linkClass}>
                Get directions
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </li>
          )}
        </FooterColumn>

        <FooterColumn title="Carts">
          {stalls.map((s) => (
            <li key={s.id}>
              <Link href={`/stall/${s.slug}`} className={linkClass}>
                {s.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/#trucks" className={linkClass}>
              All food trucks
            </Link>
          </li>
        </FooterColumn>

        {socials.length > 0 && (
          <FooterColumn title="Social Links">
            {socials.map(({ handle, owner }) => (
              <li key={handle}>
                <a href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noreferrer" className="group flex items-center gap-3 transition-colors duration-150 hover:text-white">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-night-800 transition-colors duration-150 group-hover:border-white/30 group-hover:bg-night-700">
                    <InstagramIcon className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-white">@{handle}</span>
                    <span className="block truncate text-small font-normal">{owner} on Instagram</span>
                  </span>
                </a>
              </li>
            ))}
          </FooterColumn>
        )}
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-5 text-small">
          © {park?.name ?? "Open Sky Food Park"}
        </Container>
      </div>
    </footer>
  );
}
