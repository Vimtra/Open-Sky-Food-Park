// Is a truck taking orders? The same rules as _stall_closed_reason() in 0006_v16.sql:
// switched off or inactive -> "closed"; paused_until in the future -> "paused";
// auto_hours and outside its hours -> "outside_hours". Times are in the park's time zone.

import type { Stall, StallHours, StallStatus, StallWait } from "./types";

export type ClosedReason = "closed" | "paused" | "outside_hours";

const fmt = new Map<string, Intl.DateTimeFormat>();
function local(at: Date, tz: string): { dow: number; minutes: number } {
  if (!fmt.has(tz)) fmt.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }));
  const parts = fmt.get(tz)!.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function withinHours(hours: StallHours[], at: Date, tz: string): boolean {
  const { dow, minutes } = local(at, tz);
  return hours.some((h) => {
    const o = toMin(h.opens);
    const c = toMin(h.closes);
    if (o < c) return h.weekday === dow && minutes >= o && minutes < c;
    // past midnight: the evening part on its own day, the early part on the next day
    return (h.weekday === dow && minutes >= o) || (h.weekday === (dow + 6) % 7 && minutes < c);
  });
}

export function closedReason(stall: Stall, hours: StallHours[], at: Date, tz: string): ClosedReason | null {
  if (!stall.is_active || !stall.is_open) return "closed";
  if (stall.paused_until && new Date(stall.paused_until) > at) return "paused";
  if (stall.auto_hours && !withinHours(hours.filter((h) => h.stall_id === stall.id), at, tz)) return "outside_hours";
  return null;
}

/** The next time (within a week, 15-minute steps) the truck's hours open, or null. */
export function nextOpening(stall: Stall, hours: StallHours[], from: Date, tz: string): Date | null {
  const mine = hours.filter((h) => h.stall_id === stall.id);
  if (!mine.length) return null;
  const step = 15 * 60000;
  const start = Math.ceil(from.getTime() / step) * step;
  for (let t = start; t < from.getTime() + 7 * 86400000; t += step) {
    if (withinHours(mine, new Date(t), tz)) return new Date(t);
  }
  return null;
}

/** What to show on a truck card or menu: accepting or not, and a short label. */
export interface Availability {
  accepting: boolean;
  label: string | null;
}

// Device time, like the rest of the site (customers are at the park).
const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function availability(
  stall: Stall,
  opts: { status?: StallStatus; wait?: StallWait; hours: StallHours[]; tz: string; now?: Date },
): Availability {
  const now = opts.now ?? new Date();
  const reason = opts.status ? opts.status.reason : closedReason(stall, opts.hours, now, opts.tz);
  if (reason === "paused") {
    const until = opts.status?.paused_until ?? stall.paused_until;
    return { accepting: false, label: until ? `Busy · back at ${clock(new Date(until))}` : "Busy right now" };
  }
  if (reason === "outside_hours") {
    const next = nextOpening(stall, opts.hours, now, opts.tz);
    return { accepting: false, label: next ? `Opens ${clock(next)}` : "Closed now" };
  }
  if (reason === "closed") return { accepting: false, label: "Closed now" };
  const mins = opts.wait?.typical_prep_mins;
  return { accepting: true, label: mins ? `~${mins} min` : null };
}
