// Creates a Stripe PaymentIntent for an order that is waiting for payment.
// Used by the website and by the Flutter app (same request, same response).
//
//   POST /api/payments/intent
//   Authorization: Bearer <supabase access token>
//   { "order_id": "<uuid>" }
//   -> { client_secret, publishable_key, amount_cents }

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!url || !anonKey || !secretKey || !publishableKey) {
    return fail(503, "Online payment is not set up yet. Choose “Pay at the stall” instead.");
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "sign_in_required");

  const body = (await request.json().catch(() => null)) as { order_id?: unknown } | null;
  const orderId = typeof body?.order_id === "string" ? body.order_id : "";
  if (!UUID.test(orderId)) return fail(400, "A valid order_id is required.");

  // Read the order as the caller: row-level security only returns it to its owner.
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await db
    .from("orders")
    .select("id, order_no, total_cents, status, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return fail(401, "sign_in_required");
  if (!order) return fail(404, "not_found");
  if (order.payment_status === "paid") return fail(409, "This order is already paid.");
  if (order.status !== "awaiting_payment") return fail(409, "This order is not waiting for payment.");
  if (order.total_cents < 50) return fail(400, "Orders under $0.50 cannot be paid online.");

  const stripe = new Stripe(secretKey);
  try {
    // The idempotency key makes a retry return the same intent instead of creating a second charge.
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.total_cents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `Open Sky Food Park order ${order.order_no}`,
        metadata: { order_id: order.id, order_no: order.order_no },
      },
      { idempotencyKey: `osfp-order-${order.id}-${order.total_cents}` },
    );
    return Response.json({ client_secret: intent.client_secret, publishable_key: publishableKey, amount_cents: order.total_cents });
  } catch (err) {
    console.error("payment intent failed", err);
    return fail(502, "The payment provider did not respond. Try again in a moment.");
  }
}
