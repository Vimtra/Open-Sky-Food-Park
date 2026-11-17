// Stripe webhook. When a payment succeeds, marks the order paid, which moves its
// stall orders from `pending` to `placed` so the stalls see them.
// Configure in Stripe: endpoint <site>/api/payments/webhook, event payment_intent.succeeded.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!url || !serviceKey || !secretKey || !webhookSecret) {
    return Response.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature ?? "", webhookSecret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const orderId = intent.metadata?.order_id;
    if (orderId) {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: order } = await admin.from("orders").select("total_cents").eq("id", orderId).maybeSingle();
      // Only accept a payment for the exact amount the database computed.
      if (order && order.total_cents === intent.amount_received) {
        const { error } = await admin.rpc("mark_order_paid", { p_order_id: orderId, p_payment_ref: intent.id });
        if (error) {
          console.error("mark_order_paid failed", error);
          // A 500 makes Stripe retry later.
          return Response.json({ error: "Could not record the payment." }, { status: 500 });
        }
      } else {
        console.error("payment does not match order", { orderId, received: intent.amount_received });
      }
    }
  }

  return Response.json({ received: true });
}
