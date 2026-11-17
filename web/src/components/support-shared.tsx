"use client";

import { AtSign, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { imageSrc } from "@/lib/format";
import type { Stall, SupportTopic } from "@/lib/types";
import { cn, Container } from "./ui";

/** Contact-form topics, in the order the form shows them. Values match the support_topic enum. */
export const supportTopics: { value: SupportTopic; label: string }[] = [
  { value: "order", label: "Help with an order" },
  { value: "feedback", label: "Feedback" },
  { value: "lost_found", label: "Lost and found" },
  { value: "vendor", label: "Run a truck here" },
  { value: "other", label: "Something else" },
];

/** Short photo header for the Contact us and Help & Support pages (night photo, centred title). */
export function PhotoHero({
  photo,
  title,
  lead,
  children,
}: {
  /** Base name under /hero/, e.g. "table-night" (needs <name>.jpg and <name>-1280.jpg). */
  photo: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <section className="on-night relative isolate overflow-hidden bg-night-900 text-white">
      <img
        src={`/hero/${photo}.jpg`}
        srcSet={`/hero/${photo}-1280.jpg 1280w, /hero/${photo}.jpg 2400w`}
        sizes="100vw"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div aria-hidden className="hero-scrim absolute inset-0 -z-10" />
      <Container className="flex flex-col items-center py-12 text-center md:py-20">
        <h1 className="text-[2rem] leading-[2.25rem] font-extrabold tracking-[-0.03em] md:text-[3rem] md:leading-[3.25rem]">{title}</h1>
        <p className="mt-3 max-w-xl text-body text-white/85 md:text-[1.0625rem] md:leading-7">{lead}</p>
        {children}
      </Container>
    </section>
  );
}

/** A truck's direct lines: phone and Instagram, whichever the catalog has. */
export function TruckContactRow({ stall, className }: { stall: Stall; className?: string }) {
  const tel = stall.phone?.replace(/[^\d+]/g, "");
  return (
    <li className={cn("flex items-center gap-3 py-3", className)}>
      {stall.logo_url ? (
        <img src={imageSrc(stall.logo_url)!} alt="" className="size-11 shrink-0 rounded-full border border-line bg-white object-cover" />
      ) : (
        <span className="size-11 shrink-0 rounded-full bg-surface-2" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{stall.name}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-small font-medium text-ink-700">
          {stall.phone && tel && (
            <a href={`tel:${tel}`} className="inline-flex items-center gap-1 hover:text-ink-900 hover:underline">
              <Phone className="size-3.5" aria-hidden />
              {stall.phone}
            </a>
          )}
          {stall.instagram && (
            <a
              href={`https://www.instagram.com/${stall.instagram}/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-ink-900 hover:underline"
            >
              <AtSign className="size-3.5" aria-hidden />
              {stall.instagram}
            </a>
          )}
          {!stall.phone && !stall.instagram && <span className="text-ink-500">Ask at the truck window</span>}
        </p>
      </div>
    </li>
  );
}
