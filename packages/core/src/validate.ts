// Deterministic checks. The model proposes, this code decides. Nothing here
// calls an API, so every routing decision is reproducible and unit-testable.

import { checkDeliveryDate, nextDeliveryDate, weekdayOf } from "./calendar.ts";
import { maxHistoricQty, type MasterData } from "./fixtures.ts";
import type { Customer, Intent, OrderLine, ReviewReason, Route } from "./schema.ts";
import type { Extraction } from "./steps.ts";

export interface Evidence {
  source: "body" | `attachment:${number}`;
  /** Offsets in the original (unmasked) text of that source. */
  start: number;
  end: number;
}

export interface ResolvedLine {
  said: string;
  evidence: Evidence | null;
  sku: string | null;
  name: string | null;
  candidates: Array<{ sku: string; name: string }>;
  qty: number | null;
  unit: string | null;
  conversion: string | null;
}

export interface Issue {
  reason: ReviewReason;
  message: string;
  line?: number;
}

export interface Decision {
  route: Route;
  issues: Issue[];
  lines: ResolvedLine[];
  deliveryDate: string | null;
  requestedDeliveryDate: string | null;
  deliveryEvidence: Evidence | null;
}

export interface DecisionInput {
  intent: Intent;
  triageSuspicious: boolean;
  receivedAt: string;
  customer: Customer | null;
  senderAddress: string;
  extraction: Extraction | null;
  /** Finds where a quote sits in the original email. Null means the quote is not in the email. */
  locate: (said: string) => Evidence | null;
  /** Fully raw text (body and attachments), for the injection backstop. */
  rawText: string;
  /** Drafts already created from earlier emails, newest last. */
  priorDrafts: Array<{ emailId: string; customerId: string; receivedAt: string; lines: OrderLine[] }>;
}

const CASE_LIKE = new Set(["case", "bottle", "bag", "each", "box", "tray"]);

// Backstop for prompt injection, independent of the model's own judgement.
const INJECTION = [
  /\b(ignore|disregard)\b.{0,40}\b(previous|prior|above|your)\b.{0,20}\b(instructions|rules|prompt)/i,
  /\b(system|assistant|ai)\s*(note|message|instruction)?\s*(to the ai)?\s*:/i,
  /\bnote to (the )?(ai|assistant|bot|system)\b/i,
  /\b(skip|bypass)\b.{0,20}\breview\b/i,
  /\bmark\b.{0,40}\b(as )?(verified|approved|trusted)\b/i,
  /\bapprove (this|the) order\b/i,
];

function fmt(date: string) {
  return `${weekdayOf(date)} ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

function sameLines(a: OrderLine[], b: OrderLine[]) {
  const key = (ls: OrderLine[]) =>
    ls
      .map((l) => `${l.sku}:${l.qty}:${l.unit}`)
      .sort()
      .join("|");
  return a.length > 0 && key(a) === key(b);
}

export function decide(data: MasterData, input: DecisionInput): Decision {
  const issues: Issue[] = [];
  const add = (reason: ReviewReason, message: string, line?: number) => {
    if (!issues.some((i) => i.reason === reason && i.line === line)) issues.push({ reason, message, line });
  };
  const x = input.extraction;
  const c = input.customer;

  const lines: ResolvedLine[] = (x?.lines ?? []).map((l) => {
    const product = l.sku ? data.productBySku.get(l.sku) : undefined;
    return {
      said: l.said,
      evidence: input.locate(l.said),
      sku: l.sku,
      name: product?.name ?? null,
      candidates: l.candidates.flatMap((sku) => {
        const p = data.productBySku.get(sku);
        return p ? [{ sku, name: p.name }] : [];
      }),
      qty: l.qty,
      unit: l.unit,
      conversion: l.conversion,
    };
  });

  const requested = x?.requested_delivery.date ?? null;
  const deliveryEvidence = x?.requested_delivery.said ? input.locate(x.requested_delivery.said) : null;
  const base = { lines, requestedDeliveryDate: requested, deliveryEvidence };

  if (input.intent === "question" || input.intent === "complaint" || input.intent === "not_business") {
    return { route: "not_an_order", issues: [], deliveryDate: null, ...base };
  }

  // --- who is writing -------------------------------------------------------
  if (!c) {
    const guess = x?.customer_guess.customer_id ? data.customerById.get(x.customer_guess.customer_id) : undefined;
    add(
      "unknown_customer",
      guess
        ? `${input.senderAddress} is not on file. The email suggests ${guess.name} (${guess.id}), which needs confirming before anything ships.`
        : `${input.senderAddress} is not on file as a customer.`,
    );
  } else if (c.creditHold) {
    add("credit_hold", `${c.name} is on credit hold. Finance has to release new orders.`);
  }

  // --- instructions aimed at the system ---------------------------------------
  const injected = INJECTION.some((re) => re.test(input.rawText));
  if (input.triageSuspicious || injected || (x?.suspicious_instructions.length ?? 0) > 0) {
    const quote = x?.suspicious_instructions[0]?.said;
    add(
      "suspicious_instructions",
      quote
        ? `The email contains instructions aimed at the system: "${quote.slice(0, 120)}". Not followed.`
        : "The email contains text aimed at the system. Not followed.",
    );
  }

  if (input.intent === "change_order" || input.intent === "cancel_order") {
    const ref = x?.refers_to_order_id;
    const known = ref ? data.orders.find((o) => o.id === ref && o.customerId === c?.id) : undefined;
    const verb = input.intent === "cancel_order" ? "Cancellation" : "Change";
    add(
      "change_or_cancel",
      known
        ? `${verb} to ${known.id} (delivery ${fmt(known.deliveryDate)}). Changes and cancellations always go to a person.`
        : `${verb} request, but the order it refers to could not be matched. Changes and cancellations always go to a person.`,
    );
    return { route: "needs_review", issues, deliveryDate: requested, ...base };
  }

  // --- new order: lines -------------------------------------------------------
  if (!lines.length) add("missing_information", "No products could be read from the email.");

  let totalCases = 0;
  lines.forEach((line, i) => {
    const extracted = x!.lines[i]!;
    const n = i + 1;
    if (!line.evidence) {
      add("low_confidence", `Line ${n}: the quoted words "${line.said.slice(0, 60)}" are not in the email.`, i);
    }
    if (extracted.issue === "ambiguous") {
      const names = line.candidates.map((cand) => cand.name).join(" or ");
      add("ambiguous_product", `Line ${n}: "${line.said}" could be ${names || "several products"}.`, i);
      return;
    }
    if (extracted.issue === "not_in_catalog") {
      add("unknown_product", `Line ${n}: "${line.said}" is not something we sell.`, i);
      return;
    }
    const product = line.sku ? data.productBySku.get(line.sku) : undefined;
    if (!product) {
      add("unknown_product", `Line ${n}: no product matched "${line.said}".`, i);
      return;
    }
    if (!product.active) {
      add("unknown_product", `Line ${n}: ${product.name} is discontinued.`, i);
      return;
    }
    if (extracted.issue === "quantity_unclear" || line.qty == null || line.unit == null) {
      add("missing_information", `Line ${n}: the quantity for "${line.said}" is unclear.`, i);
      return;
    }
    if (line.unit !== product.unit) {
      add("missing_information", `Line ${n}: ${product.name} is sold per ${product.unit}, not per ${line.unit}.`, i);
      return;
    }
    if (CASE_LIKE.has(product.unit) && !Number.isInteger(line.qty)) {
      add("missing_information", `Line ${n}: ${line.qty} ${product.unit} is not a whole number.`, i);
      return;
    }
    if (line.qty > product.stock) {
      add(
        "out_of_stock",
        product.stock === 0
          ? `Line ${n}: ${product.name} is out of stock.`
          : `Line ${n}: ${line.qty} ${product.unit} of ${product.name} requested, ${product.stock} in stock.`,
        i,
      );
    }
    if (c) {
      const max = maxHistoricQty(data, c.id, product.sku);
      if (max != null ? line.qty > max * 4 : line.qty > c.usualCasesPerOrder * 2) {
        add(
          "unusual_quantity",
          max != null
            ? `Line ${n}: ${line.qty} ${product.unit} of ${product.name}. Their largest order so far was ${max}.`
            : `Line ${n}: ${line.qty} ${product.unit} of ${product.name}, a product they have never ordered.`,
          i,
        );
      }
    }
    if (CASE_LIKE.has(product.unit)) totalCases += line.qty;
  });

  if (c && totalCases > c.usualCasesPerOrder * 4) {
    add("unusual_quantity", `${totalCases} units in one order. ${c.name} usually orders about ${c.usualCasesPerOrder}.`);
  }

  // --- delivery date ----------------------------------------------------------
  let deliveryDate: string | null = null;
  if (c) {
    if (requested) {
      const check = checkDeliveryDate(requested, input.receivedAt, c.deliveryDays);
      if (check.ok) deliveryDate = requested;
      else {
        add(
          "invalid_delivery_date",
          check.why === "too_soon"
            ? `Asked for ${fmt(requested)}, which is too soon. Earliest possible: ${fmt(check.earliest)}.`
            : `Asked for ${fmt(requested)}, but ${c.name} gets deliveries on ${c.deliveryDays.join(", ")}. Next option: ${fmt(check.earliest)}.`,
        );
        deliveryDate = requested;
      }
    } else {
      deliveryDate = nextDeliveryDate(input.receivedAt, c.deliveryDays);
    }
  } else {
    deliveryDate = requested;
  }

  // --- duplicates --------------------------------------------------------------
  if (c) {
    const resolved: OrderLine[] = lines.flatMap((l) =>
      l.sku && l.qty != null && l.unit ? [{ sku: l.sku, qty: l.qty, unit: l.unit as OrderLine["unit"] }] : [],
    );
    const windowStart = new Date(new Date(input.receivedAt).getTime() - 72 * 3600_000).toISOString();
    const dup = input.priorDrafts.find(
      (d) => d.customerId === c.id && d.receivedAt >= windowStart && d.receivedAt < input.receivedAt && sameLines(d.lines, resolved),
    );
    if (dup) add("possible_duplicate", `Same lines as ${dup.emailId}, received ${fmt(dup.receivedAt.slice(0, 10))}. Possibly sent twice.`);
  }

  return { route: issues.length ? "needs_review" : "create_draft", issues, deliveryDate, ...base };
}

/** Reasons a customer can fix by answering an email. Anything else is an internal call. */
export const CUSTOMER_ANSWERABLE = new Set<ReviewReason>([
  "ambiguous_product",
  "unknown_product",
  "missing_information",
  "invalid_delivery_date",
  "out_of_stock",
]);
