import type { RouteName } from "./types.ts";

const TZ = "Europe/Amsterdam";

export function dayTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return `${day} ${time}`;
}

export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function usd(n: number, digits = 3): string {
  return `$${n.toFixed(digits)}`;
}

export function seconds(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function pct(n: number | null): string {
  return n == null ? "n/a" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

export const ROUTE_LABEL: Record<RouteName, string> = {
  create_draft: "Draft created",
  needs_review: "Needs review",
  not_an_order: "Not an order",
};

export const REASON_LABEL: Record<string, string> = {
  unknown_customer: "Unknown sender",
  ambiguous_product: "Ambiguous product",
  unknown_product: "Not in catalog",
  unusual_quantity: "Unusual quantity",
  invalid_delivery_date: "Delivery date",
  credit_hold: "Credit hold",
  out_of_stock: "Stock",
  change_or_cancel: "Change or cancel",
  suspicious_instructions: "Instructions to the system",
  possible_duplicate: "Possible duplicate",
  missing_information: "Unclear",
  low_confidence: "Unverified quote",
};

export const INTENT_LABEL: Record<string, string> = {
  new_order: "New order",
  change_order: "Change",
  cancel_order: "Cancellation",
  question: "Question",
  complaint: "Complaint",
  not_business: "Not business",
};
