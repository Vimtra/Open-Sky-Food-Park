// Kitchen ticket printing for the stall dashboard (ROADMAP S5).
// Builds an 80 mm receipt in a hidden iframe and prints that, so the dashboard's own layout and
// styles never change. Works with any receipt printer the browser can print to.

import { money, timeOfDay } from "@/lib/format";
import type { StallTicket } from "@/lib/types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** What this stall collects for a ticket: its dishes, minus its coupon share, plus its tax share. */
export const ticketDue = (t: StallTicket) => t.subtotal_cents - (t.discount_cents ?? 0) + (t.tax_cents ?? 0);

export function ticketHtml(t: StallTicket, stallName: string): string {
  const table = t.order.fulfilment === "table";
  const collect = t.order.payment_method === "pay_at_stall" && t.order.payment_status !== "paid";
  const items = t.order_items
    .map((i) => `<tr><td class="q">${i.qty}×</td><td>${esc(i.name)}${i.note ? `<div class="n">${esc(i.note)}</div>` : ""}</td></tr>`)
    .join("");
  const status = t.status === "cancelled" ? `<p class="x">CANCELLED</p>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Token ${t.token_no}</title><style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 74mm; font: 13px/1.35 ui-monospace, "Cascadia Mono", Consolas, monospace; color: #000; }
    .c { text-align: center; }
    h1 { margin: 0; font-size: 15px; }
    .tok { margin: 6px 0 2px; font-size: 44px; font-weight: 800; line-height: 1; }
    .lbl { font-size: 11px; letter-spacing: .12em; }
    .who { margin: 6px 0 0; font-size: 16px; font-weight: 800; }
    .row { display: flex; justify-content: space-between; font-size: 12px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { vertical-align: top; padding: 2px 0; }
    td.q { width: 9mm; font-weight: 800; }
    .n { font-size: 12px; font-style: italic; }
    .note { padding: 4px; border: 1px solid #000; font-size: 13px; }
    .pay { font-weight: 800; font-size: 14px; }
    .x { text-align: center; font-weight: 800; font-size: 18px; border: 2px solid #000; padding: 2px; }
  </style></head><body>
    <div class="c"><h1>${esc(stallName)}</h1><div class="lbl">TOKEN</div><div class="tok">${t.token_no}</div>
    <p class="who">${esc(t.order.customer_name)}</p></div>
    ${status}
    <div class="row"><span>${esc(t.order.order_no)}</span><span>${timeOfDay(t.placed_at ?? t.created_at)}</span></div>
    <div class="row"><span>${table ? `TABLE ${esc(t.order.table_no ?? "")}` : "PICKUP"}</span><span>${new Date(t.placed_at ?? t.created_at).toLocaleDateString("en-US")}</span></div>
    <hr><table>${items}</table><hr>
    ${t.order.note ? `<p class="note"><b>Note:</b> ${esc(t.order.note)}</p>` : ""}
    <p class="pay">${collect ? `COLLECT ${money(ticketDue(t))}` : `PAID ONLINE ${money(ticketDue(t))}`}</p>
  </body></html>`;
}

/** Prints one ticket. Returns false if the browser blocked it. */
export function printTicket(t: StallTicket, stallName: string): boolean {
  if (typeof document === "undefined") return false;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(ticketHtml(t, stallName));
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });
  // Let the iframe lay out before printing.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(cleanup, 60_000); // fallback if afterprint never fires
    }
  }, 50);
  return true;
}
