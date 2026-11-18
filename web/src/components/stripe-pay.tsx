"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Notice } from "./ui";

interface Props {
  clientSecret: string;
  publishableKey: string;
  amountLabel: string;
  returnUrl: string;
  /** Stripe accepted the payment (or is still processing it). The id lets the server check it. */
  onSucceeded: (paymentIntentId: string) => void;
}

const stripeByKey = new Map<string, Promise<Stripe | null>>();

/** After this long with no answer, the customer is probably on Cash App's QR code or a bank page. */
const SLOW_MS = 4000;

function Form({ amountLabel, returnUrl, onSucceeded, onReset }: Omit<Props, "clientSecret" | "publishableKey"> & { onReset: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignore the answer of an attempt the customer gave up on with "Cancel".
  const attempt = useRef(0);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const mine = ++attempt.current;
    setBusy(true);
    setSlow(false);
    setError(null);
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (mine !== attempt.current) return;
    if (result.error) {
      setError(result.error.message ?? "The payment did not go through. Try again or pick another way to pay.");
      setBusy(false);
      return;
    }
    const intent = result.paymentIntent;
    if (intent && (intent.status === "succeeded" || intent.status === "processing")) {
      onSucceeded(intent.id);
      return;
    }
    setError("The payment was not finished. Try again or pick another way to pay.");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!stripe}>
        Pay {amountLabel}
      </Button>
      {busy && slow && (
        <div className="rounded-sm border border-line bg-surface-2 p-3 text-small text-ink-700 md:rounded-[4px]" role="status">
          <p className="font-bold text-ink-900">Waiting for you to approve the payment</p>
          <p className="mt-1">
            Paying with Cash App on a computer? Scan the QR code with your phone&apos;s camera and approve it there. This page moves on by itself
            once it goes through.
          </p>
          <button
            type="button"
            className="mt-2 font-bold text-ember-700 underline"
            onClick={() => {
              attempt.current++;
              setBusy(false);
              setSlow(false);
              onReset();
            }}
          >
            Cancel and choose again
          </button>
        </div>
      )}
    </form>
  );
}

/** Stripe Payment Element (card, Apple Pay, Google Pay, Cash App Pay…). Loaded only when the real backend is connected. */
export function StripePay({ clientSecret, publishableKey, ...rest }: Props) {
  const stripe = useMemo(() => {
    if (!stripeByKey.has(publishableKey)) stripeByKey.set(publishableKey, loadStripe(publishableKey));
    return stripeByKey.get(publishableKey)!;
  }, [publishableKey]);
  // Remounting the form gives the customer a fresh payment form after a cancelled attempt.
  const [round, setRound] = useState(0);

  return (
    <Elements
      key={round}
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#f06405", colorText: "#0e1330", borderRadius: "12px", fontFamily: "Figtree, system-ui, sans-serif" },
        },
      }}
    >
      <Form {...rest} onReset={() => setRound((r) => r + 1)} />
    </Elements>
  );
}
