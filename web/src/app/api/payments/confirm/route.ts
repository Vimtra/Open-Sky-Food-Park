// Checks a payment with Stripe right after the customer pays, and marks the order
// paid if Stripe says it succeeded. The webhook does the same thing; this route means
// the order does not wait for the webhook (or get stuck if the webhook is not set up).
//
//   POST /api/payments/confirm
//   Authorization: Bearer <supabase access token>
//   { "order_id": "<uuid>", "payment_intent": "pi_..." }
//   -> { status: "paid" | "processing" | "failed" | "waiting" }

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTENT = /^pi_[A-Za-z0-9]+$/;
const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey || !secretKey) return fail(503, "Online payment is not set up yet.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "sign_in_required");

  const body = (await request.json().catch(() => null)) as { order_id?: unknown; payment_intent?: unknown } | null;
  const orderId = typeof body?.order_id === "string" ? body.order_id : "";
  const intentId = typeof body?.payment_intent === "string" ? body.payment_intent : "";
  if (!UUID.test(orderId) || !INTENT.test(intentId)) return fail(400, "order_id and payment_intent are required.");

  // Read the order as the caller: row-level security only returns it to its owner.
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await db.from("orders").select("id, total_cents, payment_status").eq("id", orderId).maybeSingle();
  if (error) return fail(401, "sign_in_required");
  if (!order) return fail(404, "not_found");
  if (order.payment_status === "paid") return Response.json({ status: "paid" });

  let intent: Stripe.PaymentIntent;
  try {
    intent = await new Stripe(secretKey).paymentIntents.retrieve(intentId);
  } catch {
    return fail(502, "The payment provider did not respond. Try again in a moment.");
  }
  // The intent must belong to this order: never trust the id the browser sent on its own.
  if (intent.metadata?.order_id !== order.id) return fail(400, "That payment is for a different order.");

  if (intent.status === "succeeded") {
    if (intent.amount_received !== order.total_cents) {
      console.error("payment does not match order", { orderId, received: intent.amount_received });
      return fail(409, "The amount paid does not match this order. Please contact the park.");
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: markError } = await admin.rpc("mark_order_paid", { p_order_id: order.id, p_payment_ref: intent.id });
    if (markError) {
      console.error("mark_order_paid failed", markError);
      return fail(500, "Payment received, but we could not update the order. Please refresh in a moment.");
    }
    return Response.json({ status: "paid" });
  }
  if (intent.status === "processing") return Response.json({ status: "processing" });
  if (intent.status === "requires_payment_method" || intent.status === "canceled") return Response.json({ status: "failed" });
  return Response.json({ status: "waiting" });
}
