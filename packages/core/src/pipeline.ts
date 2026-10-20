import { addUsage, ZERO_USAGE, type Usage } from "./cost.ts";
import type { MasterData } from "./fixtures.ts";
import { readEml, type Email } from "./ingest.ts";
import { mask, toOriginalOffset, type Masked, type MaskSpan } from "./mask.ts";
import type { OrderLine } from "./schema.ts";
import type { Sample } from "./samples.ts";
import {
  draftReply,
  extract,
  lookups,
  triage,
  type EmailContext,
  type Extraction,
  type ReplyDraft,
  type StepCost,
  type ToolCall,
  type Triage,
} from "./steps.ts";
import { CUSTOMER_ANSWERABLE, decide, type Decision, type Evidence } from "./validate.ts";
import { weekdayOf } from "./calendar.ts";

export interface Step {
  name: "read" | "mask" | "triage" | "extract" | "decide" | "reply";
  ms: number;
  cost: StepCost | null;
  note: string;
  /** True when the model's output was replayed from a recorded sample. */
  sample: boolean;
}

/** Where model output comes from: the API, or recorded samples (no API calls, no cost). */
export type Brain = { kind: "live"; model: string } | { kind: "sample"; samples: Map<string, Sample> };

function sampleFor(brain: Extract<Brain, { kind: "sample" }>, id: string): Sample {
  const s = brain.samples.get(id);
  if (!s) throw new Error(`no recorded sample for ${id}`);
  return s;
}

export interface Analysis {
  email: Email;
  maskedBody: Masked;
  maskedAttachments: Masked[];
  customerId: string | null;
  triage: Triage;
  extraction: Extraction | null;
  toolCalls: ToolCall[];
  steps: Step[];
}

export interface ProcessedEmail {
  emailId: string;
  receivedAt: string;
  from: { name: string; address: string };
  subject: string;
  body: string;
  attachments: Array<{ filename: string; text: string }>;
  /** What the model saw. */
  maskedBody: string;
  maskSpans: MaskSpan[];
  customer: { id: string; name: string; city: string; language: string } | null;
  triage: Triage;
  extraction: Extraction | null;
  toolCalls: ToolCall[];
  decision: Decision;
  reply: ReplyDraft | null;
  steps: Step[];
  totals: { costUsd: number; ms: number; usage: Usage };
}

const ORDERISH = new Set(["new_order", "change_order", "cancel_order"]);

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function since(t: number) {
  return Math.round(performance.now() - t);
}

// --- finding quotes in the original text --------------------------------------

function condense(text: string): { chars: string; map: number[] } {
  let chars = "";
  const map: number[] = [];
  let lastSpace = false;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i]!;
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = " ";
      lastSpace = true;
    } else lastSpace = false;
    ch = ch.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
    chars += ch;
    map.push(i);
  }
  return { chars, map };
}

function findLoose(hay: string, needle: string): { start: number; end: number } | null {
  const exact = hay.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length };
  const h = condense(hay);
  const n = condense(needle.trim()).chars;
  if (!n) return null;
  const at = h.chars.indexOf(n);
  if (at < 0) return null;
  return { start: h.map[at]!, end: h.map[at + n.length - 1]! + 1 };
}

function makeLocator(body: Masked, attachments: Masked[]) {
  return (said: string): Evidence | null => {
    if (!said.trim()) return null;
    const inBody = findLoose(body.text, said);
    if (inBody) {
      return { source: "body", start: toOriginalOffset(body, inBody.start), end: toOriginalOffset(body, inBody.end) };
    }
    for (let i = 0; i < attachments.length; i++) {
      const hit = findLoose(attachments[i]!.text, said);
      if (hit) {
        return {
          source: `attachment:${i}`,
          start: toOriginalOffset(attachments[i]!, hit.start),
          end: toOriginalOffset(attachments[i]!, hit.end),
        };
      }
    }
    return null;
  };
}

// --- phase 1: everything that needs the model, safe to run in parallel ------------

export async function analyze(data: MasterData, file: string, id: string, brain: Brain): Promise<Analysis> {
  const steps: Step[] = [];

  let t = performance.now();
  const email = await readEml(file, id);
  steps.push({
    name: "read",
    ms: since(t),
    cost: null,
    sample: false,
    note: email.attachments.length ? `Parsed the email and ${plural(email.attachments.length, "attachment")}.` : "Parsed the email.",
  });

  t = performance.now();
  const maskedBody = mask(email.text);
  const maskedAttachments = email.attachments.map((a) => mask(a.text));
  const masked = maskedBody.spans.length + maskedAttachments.reduce((s, m) => s + m.spans.length, 0);
  steps.push({
    name: "mask",
    ms: since(t),
    cost: null,
    sample: false,
    note: masked ? `Masked ${plural(masked, "contact detail")} before any model call.` : "No contact details to mask.",
  });

  const customer = data.customerByEmail.get(email.from.address) ?? null;
  const ctx: EmailContext = {
    receivedAt: email.receivedAt,
    senderName: email.from.name,
    subject: email.subject,
    body: maskedBody.text,
    attachments: email.attachments.map((a, i) => ({ filename: a.filename, text: maskedAttachments[i]!.text })),
    customer,
  };

  let triageResult: Triage;
  if (brain.kind === "live") {
    const tri = await triage(ctx, brain.model);
    triageResult = tri.result;
    steps.push({ name: "triage", ms: tri.cost.ms, cost: tri.cost, sample: false, note: `${tri.result.intent}: ${tri.result.summary}` });
  } else {
    triageResult = sampleFor(brain, id).triage;
    steps.push({ name: "triage", ms: 0, cost: null, sample: true, note: `${triageResult.intent}: ${triageResult.summary}` });
  }

  let extraction: Extraction | null = null;
  let toolCalls: ToolCall[] = [];
  if (ORDERISH.has(triageResult.intent)) {
    if (brain.kind === "live") {
      const ex = await extract(data, ctx, brain.model);
      extraction = ex.result;
      toolCalls = ex.toolCalls;
      steps.push({
        name: "extract",
        ms: ex.cost.ms,
        cost: ex.cost,
        sample: false,
        note: `${plural(ex.result.lines.length, "line")} after ${plural(ex.toolCalls.length, "lookup")}.`,
      });
    } else {
      const s = sampleFor(brain, id);
      if (!s.extraction) throw new Error(`${id}: sample has intent ${triageResult.intent} but no extraction`);
      // The lookups the model asked for run for real against the catalog and history.
      const run = lookups(data, ctx, toolCalls);
      for (const l of s.lookups) {
        if (l.tool === "search_catalog") run.search_catalog({ query: l.query });
        else if (l.tool === "get_recent_orders") run.get_recent_orders({ limit: l.limit });
        else if (l.tool === "get_open_orders") run.get_open_orders();
        else run.find_customer({ query: l.query });
      }
      extraction = s.extraction;
      steps.push({
        name: "extract",
        ms: 0,
        cost: null,
        sample: true,
        note: `${plural(extraction.lines.length, "line")} after ${plural(toolCalls.length, "lookup")}.`,
      });
    }
  }

  return { email, maskedBody, maskedAttachments, customerId: customer?.id ?? null, triage: triageResult, extraction, toolCalls, steps };
}

// --- phase 2: deterministic decision, run in arrival order ------------------------

export type PriorDraft = { emailId: string; customerId: string; receivedAt: string; lines: OrderLine[] };

export function decideFor(data: MasterData, a: Analysis, priorDrafts: PriorDraft[]): { decision: Decision; step: Step } {
  const t = performance.now();
  const customer = a.customerId ? data.customerById.get(a.customerId)! : null;
  const decision = decide(data, {
    intent: a.triage.intent,
    triageSuspicious: a.triage.suspicious,
    receivedAt: a.email.receivedAt,
    customer,
    senderAddress: a.email.from.address,
    extraction: a.extraction,
    locate: makeLocator(a.maskedBody, a.maskedAttachments),
    rawText: [a.email.text, ...a.email.attachments.map((x) => x.text)].join("\n"),
    priorDrafts,
  });
  const note =
    decision.route === "create_draft"
      ? "All checks passed. Draft order created."
      : decision.route === "not_an_order"
        ? "Not an order. Left for the team."
        : `Needs review: ${[...new Set(decision.issues.map((i) => i.reason.replace(/_/g, " ")))].join(", ")}.`;
  return { decision, step: { name: "decide", ms: since(t), cost: null, sample: false, note } };
}

export function draftLines(d: Decision): OrderLine[] {
  return d.lines.flatMap((l) => (l.sku && l.qty != null && l.unit ? [{ sku: l.sku, qty: l.qty, unit: l.unit as OrderLine["unit"] }] : []));
}

// --- phase 3: reply draft -----------------------------------------------------------

function longDate(date: string) {
  return `${weekdayOf(date)} ${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
}

export function replyFacts(data: MasterData, a: Analysis, d: Decision): string | null {
  const customer = a.customerId ? data.customerById.get(a.customerId)! : null;
  if (!customer) return null;
  // Shared mailboxes show the business name ("Café Graureiher"), not a person.
  const display = a.email.from.name.trim();
  const businessWords = new Set(customer.name.toLowerCase().split(/\s+/));
  const looksLikeBusiness = !display || display.toLowerCase().split(/\s+/).some((w) => businessWords.has(w));
  const contact = (looksLikeBusiness ? customer.contactName : display).split(/\s+/)[0];
  const header = [`Contact first name: ${contact}`, `Business: ${customer.name}`, `Their subject line: ${a.email.subject}`];
  if (d.route === "create_draft") {
    const lines = d.lines.map((l) => {
      const p = data.productBySku.get(l.sku!)!;
      return `- ${l.qty} ${p.unit} ${p.name} (${p.packSize})`;
    });
    return [...header, "Type: confirmation", "Lines:", ...lines, `Delivery: ${longDate(d.deliveryDate!)}`].join("\n");
  }
  if (d.route === "needs_review" && d.issues.every((i) => CUSTOMER_ANSWERABLE.has(i.reason))) {
    const questions = d.issues.map((i) => `- ${i.message}`);
    const clean = d.lines.filter((_, i) => !d.issues.some((x) => x.line === i));
    return [
      ...header,
      "Type: clarification",
      "What needs answering:",
      ...questions,
      clean.length ? "Lines that are fine as they are:" : "",
      ...clean.map((l) => `- ${l.qty} ${l.unit} ${l.name}`),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return null;
}

export async function finish(
  data: MasterData,
  a: Analysis,
  decision: Decision,
  decideStep: Step,
  brain: Brain,
): Promise<ProcessedEmail> {
  const steps = [...a.steps, decideStep];
  let reply: ReplyDraft | null = null;
  const facts = replyFacts(data, a, decision);
  if (facts) {
    const note = decision.route === "create_draft" ? "Drafted a confirmation. Not sent." : "Drafted a clarifying question. Not sent.";
    if (brain.kind === "live") {
      // Answer in the language they wrote in, not the one on file.
      const customer = data.customerById.get(a.customerId!)!;
      const language = a.triage.language === "other" ? customer.language : a.triage.language;
      const r = await draftReply(facts, language, brain.model);
      reply = r.result;
      steps.push({ name: "reply", ms: r.cost.ms, cost: r.cost, sample: false, note });
    } else {
      reply = sampleFor(brain, a.email.id).reply;
      if (!reply) throw new Error(`${a.email.id}: a reply is needed but the sample has none`);
      steps.push({ name: "reply", ms: 0, cost: null, sample: true, note });
    }
  }

  const usage = steps.reduce((u, s) => (s.cost ? addUsage(u, s.cost.usage) : u), ZERO_USAGE);
  const customer = a.customerId ? data.customerById.get(a.customerId)! : null;
  return {
    emailId: a.email.id,
    receivedAt: a.email.receivedAt,
    from: a.email.from,
    subject: a.email.subject,
    body: a.email.text,
    attachments: a.email.attachments.map((x) => ({ filename: x.filename, text: x.text })),
    maskedBody: a.maskedBody.text,
    maskSpans: a.maskedBody.spans,
    customer: customer ? { id: customer.id, name: customer.name, city: customer.city, language: customer.language } : null,
    triage: a.triage,
    extraction: a.extraction,
    toolCalls: a.toolCalls,
    decision,
    reply,
    steps,
    totals: {
      costUsd: Math.round(steps.reduce((s, x) => s + (x.cost?.costUsd ?? 0), 0) * 1e6) / 1e6,
      ms: steps.reduce((s, x) => s + x.ms, 0),
      usage,
    },
  };
}
