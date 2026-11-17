"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, AtSign, CircleCheck, Clock, LifeBuoy, Mail, MapPin, Phone, Receipt } from "lucide-react";
import { useState, type ReactNode } from "react";
import { backend, formatPhone, isDemo, normalizePhone } from "@/lib/backend";
import { friendlyError, isOrderLive } from "@/lib/format";
import { useCatalog, useMyOrders, useSession } from "@/lib/hooks";
import type { SupportTopic } from "@/lib/types";
import { PhotoHero, supportTopics, TruckContactRow } from "./support-shared";
import { Button, ButtonLink, cn, Container, Field, inputClass, Notice } from "./ui";


const isTopic = (v: string | null): v is SupportTopic => supportTopics.some((t) => t.value === v);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MESSAGE = 2000;

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface-0 p-5 md:p-6" aria-label={title}>
      <h2 className="flex items-center gap-2.5 text-subheading font-extrabold">
        <span className="flex size-9 items-center justify-center rounded-full bg-ember-50 text-ember-700">{icon}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ContactForm() {
  const params = useSearchParams();
  const { session } = useSession("customer");
  const { orders } = useMyOrders(Boolean(session));

  const [topic, setTopic] = useState<SupportTopic>(() => {
    const t = params.get("topic");
    return isTopic(t) ? t : "order";
  });
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [orderNo, setOrderNo] = useState(() => params.get("order")?.toUpperCase() ?? "");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ ref: string; contact: string } | null>(null);

  // Prefill from the signed-in profile once, without overwriting anything typed.
  const seed = session ? `${session.user_id}` : "";
  const [seeded, setSeeded] = useState("");
  if (seed && seeded !== seed) {
    setSeeded(seed);
    if (!name && session?.profile.full_name) setName(session.profile.full_name);
    if (!contact && session?.profile.phone) setContact(formatPhone(session.profile.phone));
  }

  const contactValue = contact.trim();
  const contactOk = EMAIL.test(contactValue) || normalizePhone(contactValue) !== null;
  const errors = {
    name: !name.trim() ? "Add your name." : null,
    contact: !contactValue ? "Add an email or phone number so we can reply." : !contactOk ? "Enter a valid email, or a 10-digit phone number." : null,
    message: message.trim().length < 5 ? "Tell us a little about it." : null,
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    const firstBad = errors.name ? "contact-name" : errors.contact ? "contact-reach" : errors.message ? "contact-message" : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }
    setBusy(true);
    try {
      const phone = EMAIL.test(contactValue) ? null : normalizePhone(contactValue);
      const result = await backend().submitSupportRequest({
        name: name.trim(),
        contact: phone ?? contactValue,
        topic,
        order_no: topic === "order" ? orderNo.trim() || null : null,
        message: message.trim(),
      });
      setSent({ ref: result.ref_no, contact: phone ? formatPhone(phone) : contactValue });
      setMessage("");
      setTouched(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="animate-fade-in rounded-xl border border-leaf-600/30 bg-leaf-50 p-6 md:p-8" role="status">
        <CircleCheck className="size-10 text-leaf-600" strokeWidth={2.25} aria-hidden />
        <h2 className="mt-4 text-title">Message sent</h2>
        <p className="mt-2 max-w-md text-ink-700">
          The park team will reply to <strong className="text-ink-900">{sent.contact}</strong>. If you follow up, mention reference{" "}
          <strong className="text-ink-900 tabular-nums">{sent.ref}</strong>.
        </p>
        {isDemo && <p className="mt-3 text-small text-ink-700">Demo: the message is kept in this browser and shows up in Admin → Messages.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="dark">
            Back to the trucks
          </ButtonLink>
          <Button variant="outline" onClick={() => setSent(null)}>
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  const myOrders = orders?.slice(0, 8) ?? [];
  const live = orders?.find(isOrderLive);

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-surface-0 p-5 md:p-8" aria-labelledby="form-heading">
      <h2 id="form-heading" className="text-title">
        Send us a message
      </h2>
      <p className="mt-1 text-ink-700">Questions about an order, the park, or running a truck here.</p>

      {live && (
        <Notice tone="warn" className="mt-5">
          Waiting on food right now? The truck can help fastest.{" "}
          <Link href={`/orders/${live.id}`} className="font-bold underline">
            Open order {live.order_no}
          </Link>
        </Notice>
      )}

      <fieldset className="mt-6">
        <legend className="text-label text-ink-900">What is it about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {supportTopics.map((t) => {
            const selected = t.value === topic;
            return (
              <label
                key={t.value}
                className={cn(
                  "relative inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-label transition-colors duration-150",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ember-600",
                  selected ? "border-night-900 bg-night-900 text-white" : "border-line bg-white text-ink-700 hover:border-line-strong hover:bg-surface-1",
                )}
              >
                <input type="radio" name="topic" value={t.value} checked={selected} onChange={() => setTopic(t.value)} className="sr-only" />
                {t.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" error={touched ? errors.name : null}>
          <input
            id="contact-name"
            autoComplete="name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            aria-invalid={touched && Boolean(errors.name)}
          />
        </Field>
        <Field label="Email or phone" htmlFor="contact-reach" hint="So we can reply." error={touched ? errors.contact : null}>
          <input
            id="contact-reach"
            autoComplete="email"
            inputMode="email"
            value={contact}
            maxLength={120}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
            aria-invalid={touched && Boolean(errors.contact)}
          />
        </Field>
      </div>

      {topic === "order" && (
        <div className="mt-4 max-w-xs">
          <Field label="Order number (optional)" htmlFor="contact-order" hint={myOrders.length ? undefined : "It starts with OS-, on your order page."}>
            {myOrders.length ? (
              <select id="contact-order" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className={inputClass}>
                <option value="">Not about a specific order</option>
                {myOrders.map((o) => (
                  <option key={o.id} value={o.order_no}>
                    {o.order_no} · {o.stall_orders.map((s) => s.stall?.name ?? "Truck").join(" + ")}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="contact-order"
                value={orderNo}
                maxLength={20}
                onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
                placeholder="OS-"
                className={`${inputClass} uppercase tabular-nums`}
              />
            )}
          </Field>
        </div>
      )}

      <div className="mt-4">
        <Field
          label="Message"
          htmlFor="contact-message"
          hint={`${message.length.toLocaleString()} / ${MAX_MESSAGE.toLocaleString()}`}
          error={touched ? errors.message : null}
        >
          <textarea
            id="contact-message"
            rows={5}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            className={`${inputClass} h-auto resize-y py-3`}
            aria-invalid={touched && Boolean(errors.message)}
          />
        </Field>
      </div>

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button type="submit" size="lg" loading={busy}>
          Send message
        </Button>
        <p className="text-small text-ink-500">For allergy questions, ask the truck before you order.</p>
      </div>
    </form>
  );
}

export function ContactScreen() {
  const { index } = useCatalog();
  const park = index?.catalog.park;
  const stalls = index?.stalls ?? [];
  const directions = park?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${park.name}, ${park.address}`)}` : null;
  const parkTel = park?.contact_phone?.replace(/[^\d+]/g, "");

  return (
    <>
      <PhotoHero photo="table-night" title="Contact us" lead="Questions about an order, the park, or bringing your truck to Open Sky? Send the park team a message." />

      <Container className="py-8 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <ContactForm />

          <div className="space-y-4">
            <InfoCard icon={<MapPin className="size-4.5" aria-hidden />} title="Visit the park">
              {park?.address ? <p className="font-semibold">{park.address}</p> : <p className="text-ink-500">Address coming soon.</p>}
              {park?.hours_text && (
                <p className="mt-2 flex items-center gap-2 text-label font-medium text-ink-700">
                  <Clock className="size-4" aria-hidden />
                  {park.hours_text}
                </p>
              )}
              {directions && (
                <a href={directions} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-1.5 text-label font-bold text-ember-700 hover:underline">
                  Get directions
                  <ArrowUpRight className="size-4" aria-hidden />
                </a>
              )}
            </InfoCard>

            <InfoCard icon={<LifeBuoy className="size-4.5" aria-hidden />} title="Reach the park team">
              <ul className="space-y-2.5 text-[0.9375rem] font-semibold">
                {park?.contact_phone && parkTel && (
                  <li>
                    <a href={`tel:${parkTel}`} className="inline-flex items-center gap-2 hover:underline">
                      <Phone className="size-4 text-ink-700" aria-hidden />
                      {park.contact_phone}
                    </a>
                  </li>
                )}
                {park?.contact_email && (
                  <li>
                    <a href={`mailto:${park.contact_email}`} className="inline-flex items-center gap-2 break-all hover:underline">
                      <Mail className="size-4 shrink-0 text-ink-700" aria-hidden />
                      {park.contact_email}
                    </a>
                  </li>
                )}
                {park?.instagram && (
                  <li>
                    <a
                      href={`https://www.instagram.com/${park.instagram}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      <AtSign className="size-4 text-ink-700" aria-hidden />
                      {park.instagram} on Instagram
                    </a>
                  </li>
                )}
              </ul>
              {!park?.contact_phone && !park?.contact_email && (
                <p className="mt-2 text-small text-ink-500">The form on this page reaches the park team directly.</p>
              )}
            </InfoCard>

            {stalls.length > 0 && (
              <InfoCard icon={<Receipt className="size-4.5" aria-hidden />} title="Ask a truck directly">
                <p className="text-label font-medium text-ink-700">For a dish, an allergy question, or food you are waiting for, the truck can help fastest.</p>
                <ul className="mt-1 divide-y divide-line">
                  {stalls.map((s) => (
                    <TruckContactRow key={s.id} stall={s} />
                  ))}
                </ul>
              </InfoCard>
            )}

            <p className="px-1 text-label font-medium text-ink-700">
              Most answers are already in{" "}
              <Link href="/help" className="font-bold text-ember-700 hover:underline">
                Help &amp; Support
              </Link>
              .
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
