"use client";

import Link from "next/link";
import { ChevronDown, CreditCard, LifeBuoy, MessageCircle, Phone, Receipt, Search, Ticket, UtensilsCrossed, User, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isOrderLive } from "@/lib/format";
import { useCatalog, useMyOrders, useSession } from "@/lib/hooks";
import type { Park } from "@/lib/types";
import { PhotoHero, TruckContactRow } from "./support-shared";
import { ButtonLink, Chip, cn, Container, DietMark } from "./ui";

interface Faq {
  id: string;
  q: string;
  /** Plain-text paragraphs. Searchable. */
  a: string[];
  /** Optional illustration or link row under the answer. */
  extra?: ReactNode;
  link?: { href: string; label: string };
}

interface Topic {
  id: string;
  title: string;
  icon: ReactNode;
  faqs: Faq[];
}

/** Every answer describes how this product actually works today. Park settings decide the data-driven ones. */
function buildTopics(park: Park): Topic[] {
  const table = park.table_service_enabled;
  const tax = Number(park.tax_percent);

  return [
    {
      id: "ordering",
      title: "Ordering",
      icon: <UtensilsCrossed className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "several-trucks",
          q: "How does ordering from several trucks work?",
          a: [
            "Add dishes from any truck to one cart and check out once. Each truck receives only its own part of the order and cooks it separately, so your dishes may be ready at different times.",
          ],
        },
        {
          id: "token",
          q: "What is a token number?",
          a: [
            "Each truck gives its part of your order a token number, shown on your order page. Tokens restart every day, and two trucks can give you the same number, so check which truck each token belongs to.",
          ],
        },
        {
          id: "ready",
          q: "How do I know when my food is ready?",
          a: [
            "Keep your order page open. Each truck's part moves from Sent to Preparing to Ready, and the page updates by itself.",
            table
              ? "For pickup, collect from that truck when its token shows Ready. For table service, the truck brings it over."
              : "When a part shows Ready, collect it from that truck and show its token.",
          ],
          link: { href: "/orders", label: "Your orders" },
        },
        {
          id: "sold-out",
          q: "A dish says Sold out. What happened?",
          a: [
            "Trucks switch a dish off when they run out. If something in your cart sells out, or a truck closes before you check out, the cart marks it and you remove it to continue.",
          ],
        },
      ],
    },
    {
      id: "pickup",
      title: table ? "Pickup and table service" : "Pickup",
      icon: <Ticket className="size-4.5" aria-hidden />,
      faqs: [
        table
          ? {
              id: "pickup-or-table",
              q: "Pickup or table service: what is the difference?",
              a: [
                "Pickup: go to each truck when its token shows Ready.",
                "Table service: enter the number on your table at checkout, and each truck brings its dishes to you.",
              ],
            }
          : {
              id: "pickup-only",
              q: "How do I collect my food?",
              a: ["Go to each truck when its token shows Ready on your order page, and show the token at the window."],
            },
        {
          id: "where-trucks",
          q: "Where do I collect from?",
          a: ["From the truck that made the dish. Your order page names the truck for every token, and you can call a truck from there when it lists a phone number."],
        },
      ],
    },
    {
      id: "payment",
      title: "Payment",
      icon: <CreditCard className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "how-pay",
          q: "How can I pay?",
          a: [
            "Pay now: card, Apple Pay or Google Pay. One payment covers every truck in your order.",
            "Pay at the stall: pay each truck for its part when you collect.",
          ],
        },
        {
          id: "tax",
          q: "Are taxes or fees added at checkout?",
          a: [
            tax > 0
              ? `Menu prices do not include sales tax. The cart adds ${tax}% sales tax and shows the full total before you order.`
              : "The cart shows the full total before you order, including anything added on top of menu prices.",
            ...(park.service_fee_cents > 0 ? ["A small service fee per order is shown in the cart before you pay."] : []),
          ],
        },
        {
          id: "stuck-payment",
          q: "I paid, but my order still says Waiting for payment.",
          a: [
            "The trucks start as soon as the payment is confirmed, which usually takes a moment. Refresh your order page. If you were charged and it still has not moved, send us a message with your order number.",
          ],
          link: { href: "/contact?topic=order", label: "Message the park team" },
        },
      ],
    },
    {
      id: "changes",
      title: "Changes and cancellations",
      icon: <Receipt className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "cancel",
          q: "Can I cancel my order?",
          a: ["Yes, from your order page, until any truck starts preparing it. After that, speak to the truck."],
          link: { href: "/orders", label: "Your orders" },
        },
        {
          id: "wrong",
          q: "Something is wrong with my food or order.",
          a: [
            "Tell the truck first; they can fix most things on the spot. If that does not solve it, send the park team a message with your order number. If you paid online and need money back, say so in the message.",
          ],
          link: { href: "/contact?topic=order", label: "Message the park team" },
        },
      ],
    },
    {
      id: "food",
      title: "Food and allergies",
      icon: <LifeBuoy className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "allergens",
          q: "Do you list allergens or ingredients?",
          a: ["No. The menus here do not list allergens or ingredients. If you have an allergy, ask the truck before you order."],
        },
        {
          id: "diet-marks",
          q: "What do the veg, egg and non-veg marks mean?",
          a: [
            "Green dot: vegetarian. Amber dot: contains egg. Red triangle: non-vegetarian.",
            "No mark means the truck's menu does not say. Ask the truck if it matters to you.",
          ],
          extra: (
            <span className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-label font-semibold text-ink-700">
              <span className="inline-flex items-center gap-1.5">
                <DietMark diet="veg" /> Veg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DietMark diet="egg" /> Egg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <DietMark diet="nonveg" /> Non-veg
              </span>
            </span>
          ),
        },
      ],
    },
    {
      id: "account",
      title: "Your account",
      icon: <User className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "need-account",
          q: "Do I need an account?",
          a: [
            "You can browse without one. To order, sign in with your mobile number; we text you a 6-digit code. Your orders and tokens are saved to that number, so you can see them on any device.",
          ],
          link: { href: "/account", label: "Sign in" },
        },
        {
          id: "change-name",
          q: "How do I change the name on my orders?",
          a: ["Open Account and edit “Name for your orders”. Trucks call out that name with your token."],
          link: { href: "/account", label: "Account" },
        },
      ],
    },
    {
      id: "park",
      title: "The park and trucks",
      icon: <MessageCircle className="size-4.5" aria-hidden />,
      faqs: [
        {
          id: "lost",
          q: "I lost something at the park.",
          a: ["Send us a message with the topic Lost and found. Say what it is and roughly when you were here."],
          link: { href: "/contact?topic=lost_found", label: "Report a lost item" },
        },
        {
          id: "vendor",
          q: "I run a food truck. Can I join Open Sky?",
          a: ["Send us a message with the topic Run a truck here and tell us about your truck and menu."],
          link: { href: "/contact?topic=vendor", label: "Get in touch" },
        },
        {
          id: "staff",
          q: "I work at a truck. Where do I see orders?",
          a: ["Truck staff sign in at the stall dashboard with the email and password the park gave them."],
          link: { href: "/partner", label: "Stall dashboard" },
        },
      ],
    },
  ];
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}%]+/gu, " ").trim();

export function HelpScreen() {
  const { index } = useCatalog();
  const { session } = useSession("customer");
  const { orders } = useMyOrders(Boolean(session));
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const park = index?.catalog.park;
  const topics = useMemo(() => (park ? buildTopics(park) : []), [park]);
  const live = orders?.find(isOrderLive);

  // Open the question named in the URL hash (links like /help#cancel).
  const ready = topics.length > 0;
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      setOpenId(id);
      document.getElementById(id)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const q = norm(query);
  const words = q ? q.split(" ") : [];
  const visible = topics
    .filter((t) => !topicFilter || t.id === topicFilter)
    .map((t) => ({
      ...t,
      faqs: t.faqs.filter((f) => {
        if (!words.length) return true;
        const hay = norm(`${t.title} ${f.q} ${f.a.join(" ")}`);
        return words.every((w) => hay.includes(w));
      }),
    }))
    .filter((t) => t.faqs.length > 0);
  const matches = visible.reduce((n, t) => n + t.faqs.length, 0);
  const searching = words.length > 0;

  return (
    <>
      <PhotoHero photo="park-night-2" title="Help & Support" lead="How ordering, tokens and payment work at Open Sky, and how to reach us.">
        <div role="search" className="relative mt-6 w-full max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTopicFilter(null);
            }}
            placeholder="Search help, e.g. token, cancel, allergy"
            aria-label="Search help"
            className="h-13 w-full rounded-md border border-white/20 bg-white pr-12 pl-12 text-body font-medium text-ink-900 shadow-lg focus:border-ember-600 focus:ring-2 focus:ring-ember-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="hit-44 absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:bg-surface-1"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </PhotoHero>

      <Container className="py-8 md:py-12">
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Link
              href={live ? `/orders/${live.id}` : "/orders"}
              className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface-0 p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-1 md:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ember-50 text-ember-700">
                <Receipt className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-extrabold">{live ? `Track order ${live.order_no}` : "Track your order"}</span>
                <span className="mt-0.5 block text-small text-ink-700">
                  {live
                    ? live.stall_orders.map((s) => `Token ${s.token_no} · ${s.stall?.name ?? "Truck"}`).join(", ")
                    : "Tokens and status for every order"}
                </span>
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/contact"
              className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface-0 p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-1 md:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ember-50 text-ember-700">
                <MessageCircle className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-extrabold">Message the park team</span>
                <span className="mt-0.5 block text-small text-ink-700">Orders, feedback, lost and found</span>
              </span>
            </Link>
          </li>
          <li>
            <a
              href="#trucks"
              className="flex h-full items-start gap-3 rounded-xl border border-line bg-surface-0 p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-1 md:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ember-50 text-ember-700">
                <Phone className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-extrabold">Ask a truck</span>
                <span className="mt-0.5 block text-small text-ink-700">Dishes, allergies, food you are waiting for</span>
              </span>
            </a>
          </li>
        </ul>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="Help topics" className="lg:sticky lg:top-28 lg:self-start">
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
              <Chip selected={!topicFilter} onClick={() => setTopicFilter(null)} className="lg:hidden">
                All topics
              </Chip>
              {topics.map((t) => (
                <span key={t.id} className="contents">
                  <Chip
                    selected={topicFilter === t.id}
                    onClick={() => {
                      setTopicFilter(topicFilter === t.id ? null : t.id);
                      setQuery("");
                    }}
                    className="lg:hidden"
                  >
                    {t.title}
                  </Chip>
                  <button
                    type="button"
                    onClick={() => {
                      setTopicFilter(topicFilter === t.id ? null : t.id);
                      setQuery("");
                    }}
                    aria-pressed={topicFilter === t.id}
                    className={cn(
                      "hidden h-10 items-center gap-2.5 rounded-md px-3 text-left text-label transition-colors duration-150 lg:flex",
                      topicFilter === t.id ? "bg-night-900 font-bold text-white" : "font-semibold text-ink-700 hover:bg-surface-1 hover:text-ink-900",
                    )}
                  >
                    {t.icon}
                    {t.title}
                  </button>
                </span>
              ))}
            </div>
          </nav>

          <div aria-live="polite">
            {searching && (
              <p className="mb-4 text-label font-semibold text-ink-700">
                {matches === 0 ? "No answers match" : `${matches} ${matches === 1 ? "answer" : "answers"} for “${query.trim()}”`}
              </p>
            )}

            {visible.length === 0 ? (
              <div className="rounded-xl bg-surface-1 p-6 text-center md:p-10">
                <p className="text-heading">We could not find that</p>
                <p className="mt-1 text-ink-700">Try another word, or ask us directly.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <ButtonLink href="/contact">Message the park team</ButtonLink>
                  <button type="button" onClick={() => setQuery("")} className="h-11 px-3 text-label font-bold text-ember-700 hover:underline">
                    Clear search
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-9">
                {visible.map((t) => (
                  <section key={t.id} aria-labelledby={`topic-${t.id}`}>
                    <h2 id={`topic-${t.id}`} className="flex items-center gap-2.5 text-heading md:text-title">
                      <span className="flex size-9 items-center justify-center rounded-full bg-ember-50 text-ember-700">{t.icon}</span>
                      {t.title}
                    </h2>
                    <div className="mt-3 divide-y divide-line rounded-xl border border-line">
                      {t.faqs.map((f) => (
                        <details
                          key={f.id}
                          id={f.id}
                          open={searching || openId === f.id}
                          onToggle={(e) => {
                            const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                            if (!searching) setOpenId(isOpen ? f.id : openId === f.id ? null : openId);
                          }}
                          className="group scroll-mt-32"
                        >
                          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-[1.0625rem] leading-6 font-bold transition-colors duration-150 hover:bg-surface-1 md:px-5">
                            {f.q}
                            <ChevronDown className="size-5 shrink-0 text-ink-500 transition-transform duration-200 ease-enter group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="max-w-prose px-4 pb-5 text-ink-700 md:px-5">
                            {f.a.map((p, i) => (
                              <p key={i} className={i > 0 ? "mt-2" : undefined}>
                                {p}
                              </p>
                            ))}
                            {f.extra}
                            {f.link && (
                              <Link href={f.link.href} className="mt-3 inline-flex h-9 items-center text-label font-bold text-ember-700 hover:underline">
                                {f.link.label} →
                              </Link>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {index && index.stalls.length > 0 && (
              <section id="trucks" aria-labelledby="trucks-heading" className="mt-12 scroll-mt-28">
                <h2 id="trucks-heading" className="text-heading md:text-title">
                  Ask a truck directly
                </h2>
                <p className="mt-1 text-ink-700">For a dish, an allergy question, or food you are waiting for, the truck can help fastest.</p>
                <ul className="mt-2 divide-y divide-line">
                  {index.stalls.map((s) => (
                    <TruckContactRow key={s.id} stall={s} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-12 flex flex-col items-start gap-4 rounded-xl bg-surface-1 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
              <div>
                <h2 className="text-heading">Still need help?</h2>
                <p className="mt-1 text-ink-700">Send the park team a message about anything not covered here.</p>
              </div>
              <ButtonLink href="/contact" size="lg">
                Contact us
              </ButtonLink>
            </section>
          </div>
        </div>
      </Container>
    </>
  );
}
