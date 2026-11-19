// Sends queued refunds to Stripe. Refunds are queued in the database by request_refund (admin)
// or by themselves when a truck rejects, or a customer cancels, an order that was paid online.
//
//   POST /api/payments/refunds
//   Authorization: Bearer <the admin's Supabase access token>
//   { "refund_id": "<uuid>" }   send one refund
//   { }                         send every pending refund (oldest first, up to 25 per call)
//   -> { sent, failed, errors: [text] }

import Stripe from "stripe";
import { adminClient, fail } from "@/lib/server/admin-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return fail(503, "Online payment is not set up, so there is nothing to refund through Stripe.");

  const db = await adminClient(request);
  if (db instanceof Response) return db;

  const body = (await request.json().catch(() => ({}))) as { refund_id?: unknown };
  const refundId = typeof body.refund_id === "string" ? body.refund_id : null;
  if (refundId !== null && !UUID.test(refundId)) return fail(400, "A valid refund_id is required.");

  let q = db
    .from("refunds")
    .select("id, order_id, amount_cents, reason, order:orders(order_no, payment_ref, payment_method)")
    .eq("status", "pending")
    .order("created_at")
    .limit(25);
  if (refundId) q = q.eq("id", refundId);
  const { data: pending, error } = await q;
  if (error) return fail(500, "Could not read the refunds.");

  const stripe = new Stripe(secretKey);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of pending ?? []) {
    const order = (Array.isArray(r.order) ? r.order[0] : r.order) as { order_no: string; payment_ref: string | null; payment_method: string } | null;
    let ok = false;
    let stripeId: string | null = null;
    let message: string | null = null;

    if (!order?.payment_ref || !order.payment_ref.startsWith("pi_")) {
      message = "No Stripe payment is recorded for this order.";
    } else {
      try {
        // The idempotency key means a retry never refunds twice.
        const refund = await stripe.refunds.create(
          {
            payment_intent: order.payment_ref,
            amount: r.amount_cents,
            reason: "requested_by_customer",
            metadata: { order_id: r.order_id, order_no: order.order_no, refund_id: r.id, note: r.reason.slice(0, 200) },
          },
          { idempotencyKey: `osfp-refund-${r.id}` },
        );
        ok = refund.status !== "failed" && refund.status !== "canceled";
        stripeId = refund.id;
        if (!ok) message = refund.failure_reason ?? `Stripe marked the refund ${refund.status}.`;
      } catch (err) {
        message = err instanceof Stripe.errors.StripeError ? err.message : "Stripe did not respond.";
      }
    }

    const { error: recordError } = await db.rpc("record_refund_result", {
      p_refund_id: r.id,
      p_succeeded: ok,
      p_stripe_refund_id: stripeId,
      p_error: message,
    });
    if (recordError) console.error("record_refund_result failed", r.id, recordError);

    if (ok) sent += 1;
    else {
      failed += 1;
      errors.push(`${order?.order_no ?? r.order_id}: ${message}`);
    }
  }

  if (refundId && !(pending ?? []).length) return fail(404, "That refund is not waiting to be sent.");
  return Response.json({ sent, failed, errors });
}
