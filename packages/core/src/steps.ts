import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { localParts, weekdayOf } from "./calendar.ts";
import { addUsage, costUsd, fromApiUsage, ZERO_USAGE, type Usage } from "./cost.ts";
import { ordersFor, type MasterData } from "./fixtures.ts";
import { anthropic, Declined, fallbackParams, type Effort } from "./llm.ts";
import { EXTRACT_SYSTEM, REPLY_SYSTEM, TRIAGE_SYSTEM } from "./prompts.ts";
import { Intent, Unit, type Customer, type PastOrder } from "./schema.ts";
import { searchCatalog, searchCustomers } from "./search.ts";

export interface StepCost {
  model: string;
  usage: Usage;
  costUsd: number;
  ms: number;
}

export interface ToolCall {
  name: string;
  input: unknown;
  output: unknown;
}

/** What the model is allowed to see about one email. Contact details already masked. */
export interface EmailContext {
  receivedAt: string;
  senderName: string;
  subject: string;
  body: string;
  attachments: Array<{ filename: string; text: string }>;
  customer: Customer | null;
}

function describeEmail(ctx: EmailContext): string {
  const { date, hour } = localParts(ctx.receivedAt);
  const time = new Date(ctx.receivedAt).toLocaleTimeString("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  });
  const customer = ctx.customer
    ? `Known customer ${ctx.customer.id}, ${ctx.customer.name} (${ctx.customer.city}). Writes in ${ctx.customer.language}. Delivery days: ${ctx.customer.deliveryDays.join(", ")}.`
    : "Sender is not on file as a customer.";
  const parts = [
    `Received: ${weekdayOf(date)} ${date} at ${time} Amsterdam time${hour >= 14 ? " (after the 14:00 cutoff)" : ""}`,
    `From: ${ctx.senderName || "(no display name)"}`,
    customer,
    `Subject: ${ctx.subject || "(no subject)"}`,
    "",
    "<email>",
    ctx.body,
    "</email>",
  ];
  for (const a of ctx.attachments) {
    parts.push("", `<attachment filename="${a.filename}">`, a.text || "(no readable text)", "</attachment>");
  }
  return parts.join("\n");
}

function checkStop(step: string, message: { stop_reason: string | null; stop_details?: { category?: string | null } | null }) {
  if (message.stop_reason === "refusal") throw new Declined(step, message.stop_details?.category ?? null);
  if (message.stop_reason === "max_tokens") throw new Error(`${step}: hit max_tokens`);
}

// ---------------------------------------------------------------------------
// Step 1: triage
// ---------------------------------------------------------------------------

export const Triage = z.object({
  intent: Intent,
  language: z.enum(["en", "de", "es", "other"]),
  suspicious: z.boolean(),
  summary: z.string(),
});
export type Triage = z.infer<typeof Triage>;

export async function triage(ctx: EmailContext, model: string, effort: Effort = "low"): Promise<{ result: Triage; cost: StepCost }> {
  const started = performance.now();
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 4000,
    ...fallbackParams(model),
    system: [{ type: "text", text: TRIAGE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: describeEmail(ctx) }],
    output_config: { effort, format: betaZodOutputFormat(Triage) },
  });
  checkStop("triage", response);
  if (!response.parsed_output) throw new Error("triage: no parsed output");
  const usage = fromApiUsage(response.usage);
  return {
    result: response.parsed_output,
    cost: { model: response.model, usage, costUsd: costUsd(model, usage), ms: Math.round(performance.now() - started) },
  };
}

// ---------------------------------------------------------------------------
// Step 2: extraction (tool use over read-only, customer-scoped tools)
// ---------------------------------------------------------------------------

export const ExtractedLine = z.object({
  said: z.string().describe("The exact words from the email or attachment that this line comes from."),
  sku: z.string().nullable(),
  candidates: z.array(z.string()).describe("Candidate SKUs when the product is ambiguous, otherwise empty."),
  qty: z.number().nullable().describe("Quantity in the product's selling unit."),
  unit: Unit.nullable(),
  conversion: z.string().nullable().describe("How the customer's unit was converted, if it was."),
  issue: z.enum(["none", "ambiguous", "not_in_catalog", "quantity_unclear"]),
});
export type ExtractedLine = z.infer<typeof ExtractedLine>;

export const Extraction = z.object({
  lines: z.array(ExtractedLine),
  requested_delivery: z.object({
    date: z.string().nullable().describe("YYYY-MM-DD"),
    said: z.string().nullable(),
  }),
  based_on_order_id: z.string().nullable(),
  refers_to_order_id: z.string().nullable(),
  change_summary: z.string().nullable(),
  suspicious_instructions: z.array(z.object({ said: z.string() })),
  customer_guess: z.object({ customer_id: z.string().nullable(), said: z.string().nullable() }),
  note_for_reviewer: z.string().nullable(),
});
export type Extraction = z.infer<typeof Extraction>;

function summariseOrder(data: MasterData, o: PastOrder) {
  return {
    id: o.id,
    placedOn: o.placedOn,
    deliveryDate: o.deliveryDate,
    lines: o.lines.map((l) => ({ sku: l.sku, name: data.productBySku.get(l.sku)?.name ?? "?", qty: l.qty, unit: l.unit })),
  };
}

/** The four read-only lookups. Scoped to the sender: they never return another customer's orders. */
export function lookups(data: MasterData, ctx: EmailContext, calls: ToolCall[]) {
  const log = <T>(name: string, input: unknown, output: T): string => {
    calls.push({ name, input, output });
    return JSON.stringify(output);
  };
  const receivedDate = localParts(ctx.receivedAt).date;
  return {
    search_catalog: ({ query }: { query: string }) =>
      log(
        "search_catalog",
        { query },
        searchCatalog(data.catalog, query).map(({ item: p, score }) => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          packSize: p.packSize,
          unit: p.unit,
          discontinued: !p.active,
          score,
        })),
      ),
    get_recent_orders: ({ limit }: { limit: number }) => {
      if (!ctx.customer) return log("get_recent_orders", { limit }, { error: "Sender is not a known customer, so there is no order history." });
      const past = ordersFor(data, ctx.customer.id).filter((o) => o.placedOn <= receivedDate);
      return log("get_recent_orders", { limit }, past.slice(0, limit).map((o) => summariseOrder(data, o)));
    },
    get_open_orders: () => {
      if (!ctx.customer) return log("get_open_orders", {}, { error: "Sender is not a known customer." });
      const open = ordersFor(data, ctx.customer.id).filter((o) => o.deliveryDate >= receivedDate);
      return log("get_open_orders", {}, open.map((o) => summariseOrder(data, o)));
    },
    find_customer: ({ query }: { query: string }) =>
      log(
        "find_customer",
        { query },
        searchCustomers(data.customers, query).map(({ item: c }) => ({ id: c.id, name: c.name, city: c.city })),
      ),
  };
}

function customerTools(data: MasterData, ctx: EmailContext, calls: ToolCall[]) {
  const run = lookups(data, ctx, calls);
  return [
    betaZodTool({
      name: "search_catalog",
      description:
        "Search Harbor Lane's product catalog. Returns up to 8 products with SKU, name, brand, pack size, selling unit and whether it is still sold. Search one product at a time.",
      inputSchema: z.object({ query: z.string().describe("A product as the customer wrote it, or a simpler or translated form.") }),
      run: async (input) => run.search_catalog(input),
    }),
    betaZodTool({
      name: "get_recent_orders",
      description: "This customer's most recent orders, newest first, with lines. Only works when the sender is a known customer.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(5).describe("How many orders, 1 to 5.") }),
      run: async (input) => run.get_recent_orders(input),
    }),
    betaZodTool({
      name: "get_open_orders",
      description: "This customer's orders that have not been delivered yet. Use for changes and cancellations.",
      inputSchema: z.object({}),
      run: async () => run.get_open_orders(),
    }),
    betaZodTool({
      name: "find_customer",
      description: "Look up customers by business name or city. Use only when the sender is not on file. Returns id, name and city.",
      inputSchema: z.object({ query: z.string() }),
      run: async (input) => run.find_customer(input),
    }),
  ];
}

export async function extract(
  data: MasterData,
  ctx: EmailContext,
  model: string,
  effort: Effort = "medium",
): Promise<{ result: Extraction; toolCalls: ToolCall[]; cost: StepCost }> {
  const started = performance.now();
  const toolCalls: ToolCall[] = [];
  const runner = anthropic().beta.messages.toolRunner({
    model,
    max_tokens: 16000,
    max_iterations: 12,
    ...fallbackParams(model),
    cache_control: { type: "ephemeral" },
    system: [{ type: "text", text: EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: customerTools(data, ctx, toolCalls),
    messages: [{ role: "user", content: describeEmail(ctx) }],
    output_config: { effort, format: betaZodOutputFormat(Extraction) },
  });

  let usage = ZERO_USAGE;
  let last: BetaMessage | undefined;
  for await (const message of runner) {
    usage = addUsage(usage, fromApiUsage(message.usage));
    last = message;
  }
  if (!last) throw new Error("extract: no response");
  checkStop("extract", last);
  const text = last.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const result = Extraction.parse(JSON.parse(text));
  return {
    result,
    toolCalls,
    cost: { model: last.model, usage, costUsd: costUsd(model, usage), ms: Math.round(performance.now() - started) },
  };
}

// ---------------------------------------------------------------------------
// Step 3: reply draft (never sent automatically)
// ---------------------------------------------------------------------------

export const ReplyDraft = z.object({ subject: z.string(), body: z.string() });
export type ReplyDraft = z.infer<typeof ReplyDraft>;

export async function draftReply(
  facts: string,
  language: string,
  model: string,
  effort: Effort = "low",
): Promise<{ result: ReplyDraft; cost: StepCost }> {
  const started = performance.now();
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 4000,
    ...fallbackParams(model),
    system: [{ type: "text", text: REPLY_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Customer language: ${language}\n\n${facts}` }],
    output_config: { effort, format: betaZodOutputFormat(ReplyDraft) },
  });
  checkStop("reply", response);
  if (!response.parsed_output) throw new Error("reply: no parsed output");
  const usage = fromApiUsage(response.usage);
  return {
    result: response.parsed_output,
    cost: { model: response.model, usage, costUsd: costUsd(model, usage), ms: Math.round(performance.now() - started) },
  };
}
