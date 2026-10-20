import type { Weekday } from "./schema.ts";

// Delivery rules for Harbor Lane Provisions. Plain functions so the pipeline,
// the data checks and the tests all agree on what a valid date is.

export const TIME_ZONE = "Europe/Amsterdam";
export const CUTOFF_HOUR = 14;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Local calendar date (YYYY-MM-DD) and hour in Amsterdam for an ISO timestamp. */
export function localParts(iso: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]!;
}

/** First date an order received at `receivedAt` can physically ship. */
export function earliestShipDate(receivedAt: string): string {
  const { date, hour } = localParts(receivedAt);
  return addDays(date, hour < CUTOFF_HOUR ? 1 : 2);
}

/** Next date that is on or after the earliest ship date and on one of the customer's delivery days. */
export function nextDeliveryDate(receivedAt: string, deliveryDays: readonly Weekday[]): string {
  let date = earliestShipDate(receivedAt);
  for (let i = 0; i < 14; i++) {
    const wd = weekdayOf(date);
    if (wd !== "Sun" && deliveryDays.includes(wd)) return date;
    date = addDays(date, 1);
  }
  throw new Error(`no delivery day within two weeks for ${deliveryDays.join(",")}`);
}

export type DeliveryCheck =
  | { ok: true }
  | { ok: false; why: "too_soon" | "not_a_delivery_day"; earliest: string };

export function checkDeliveryDate(
  requested: string,
  receivedAt: string,
  deliveryDays: readonly Weekday[],
): DeliveryCheck {
  const earliest = nextDeliveryDate(receivedAt, deliveryDays);
  if (requested < earliestShipDate(receivedAt)) return { ok: false, why: "too_soon", earliest };
  const wd = weekdayOf(requested);
  if (wd === "Sun" || !deliveryDays.includes(wd)) return { ok: false, why: "not_a_delivery_day", earliest };
  return { ok: true };
}
