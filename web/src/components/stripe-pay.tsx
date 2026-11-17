"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";
import { Button, Notice } from "./ui";

interface Props {
  clientSecret: string;
  publishableKey: string;
  amountLabel: string;
  returnUrl: string;
  onSucceeded: () => void;
}

const stripeByKey = new Map<string, Promise<Stripe | null>>();

function Form({ amountLabel, returnUrl, onSucceeded }: Omit<Props, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (result.error) {
      setError(result.error.message ?? "The payment did not go through. Try another card.");
      setBusy(false);
      return;
    }
    // The webhook marks the order paid; the order page updates when it lands.
    onSucceeded();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!stripe}>
        Pay {amountLabel}
      </Button>
    </form>
  );
}

/** Stripe Payment Element (card, Apple Pay, Google Pay). Loaded only when the real backend is connected. */
export function StripePay({ clientSecret, publishableKey, ...rest }: Props) {
  const stripe = useMemo(() => {
    if (!stripeByKey.has(publishableKey)) stripeByKey.set(publishableKey, loadStripe(publishableKey));
    return stripeByKey.get(publishableKey)!;
  }, [publishableKey]);

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#f06405", colorText: "#0e1330", borderRadius: "12px", fontFamily: "Figtree, system-ui, sans-serif" },
        },
      }}
    >
      <Form {...rest} />
    </Elements>
  );
}
