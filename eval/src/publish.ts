// Turns a run into the JSON the website and the video read.
//
//   pnpm publish:demo --run eval/runs/<id>.json [--compare eval/reports/<a>.test.json,...]
//
// A live run must be scored first (`pnpm eval --run <file> --split all` and
// `--split test`), and its measured numbers are published. A sample run
// (`pnpm process --samples`) publishes no accuracy or cost figures at all,
// because replayed model output measures nothing.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readdir } from "node:fs/promises";
import { DATA_DIR, Label, REPO_ROOT, loadMasterData, type ProcessedEmail } from "@orderly/core";
import type { DemoData, DemoEmail, ModelComparison, RouteName, WeekSummary } from "../../packages/ui/src/types.ts";

const { values: args } = parseArgs({
  options: { run: { type: "string" }, compare: { type: "string" } },
});
if (!args.run) throw new Error("--run is required");

const runFile = path.resolve(args.run);
const base = path.join(REPO_ROOT, "eval", "reports", path.basename(runFile, ".json"));
const run = JSON.parse(await readFile(runFile, "utf8")) as { model: string; emails: ProcessedEmail[] };
const live = run.model !== "sample";
const data = await loadMasterData();

const labels = new Map<string, Label>();
for (const f of await readdir(path.join(DATA_DIR, "labels"))) {
  const l = Label.parse(JSON.parse(await readFile(path.join(DATA_DIR, "labels", f), "utf8")));
  labels.set(l.emailId, l);
}

type Row = { id: string; purpose: string; problems: string[]; expected: { route: string }; routeOk: boolean };
const all = live ? JSON.parse(await readFile(`${base}.all.json`, "utf8")) : { rows: [] };
const test = live ? JSON.parse(await readFile(`${base}.test.json`, "utf8")) : { rows: [], metrics: null };
const rowById = new Map<string, Row>(all.rows.map((r: Row) => [r.id, r]));

function describeTool(name: string, input: unknown, output: unknown): { input: string; result: string } {
  const i = input as Record<string, unknown>;
  const inputText = typeof i.query === "string" ? `"${i.query}"` : typeof i.limit === "number" ? `limit ${i.limit}` : "";
  if (output && typeof output === "object" && !Array.isArray(output) && "error" in output) {
    return { input: inputText, result: String((output as { error: string }).error) };
  }
  const list = Array.isArray(output) ? output : [];
  if (name === "search_catalog") {
    const skus = list.slice(0, 3).map((p: { sku: string }) => p.sku);
    return { input: inputText, result: list.length ? `${list.length} found: ${skus.join(", ")}${list.length > 3 ? ", …" : ""}` : "nothing found" };
  }
  if (name === "find_customer") {
    return { input: inputText, result: list.length ? list.map((c: { id: string }) => c.id).join(", ") : "nothing found" };
  }
  return { input: inputText, result: `${list.length} order${list.length === 1 ? "" : "s"}${list[0] ? `: ${list.map((o: { id: string }) => o.id).join(", ")}` : ""}` };
}

const emails: DemoEmail[] = run.emails
  .slice()
  .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  .map((p) => {
    const row = rowById.get(p.emailId);
    const d = p.decision;
    return {
      id: p.emailId,
      split: labels.get(p.emailId)?.split ?? "dev",
      receivedAt: p.receivedAt,
      from: p.from,
      subject: p.subject,
      body: p.body,
      maskedBody: p.maskedBody,
      maskSpans: p.maskSpans,
      attachments: p.attachments,
      customer: p.customer ? { id: p.customer.id, name: p.customer.name, city: p.customer.city } : null,
      intent: p.triage.intent,
      language: p.triage.language === "other" ? "en" : p.triage.language,
      summary: p.triage.summary,
      route: d.route,
      issues: d.issues,
      lines: d.lines.map((l) => {
        const product = l.sku ? data.productBySku.get(l.sku) : undefined;
        return {
          qty: l.qty,
          unit: l.unit,
          sku: l.sku,
          name: l.name,
          packSize: product?.packSize ?? null,
          said: l.said,
          evidence: l.evidence,
          conversion: l.conversion,
          candidates: l.candidates,
        };
      }),
      deliveryDate: d.deliveryDate,
      requestedDeliveryDate: d.requestedDeliveryDate,
      deliveryEvidence: d.deliveryEvidence,
      flagged: d.flaggedEvidence,
      basedOnOrderId: p.extraction?.based_on_order_id ?? null,
      refersToOrderId: p.extraction?.refers_to_order_id ?? null,
      changeSummary: p.extraction?.change_summary ?? null,
      reply: p.reply,
      steps: p.steps.map((s) => ({
        name: s.name,
        ms: s.ms,
        note: s.note,
        sample: s.sample,
        model: s.cost?.model ?? null,
        costUsd: s.cost?.costUsd ?? null,
        inputTokens: s.cost ? s.cost.usage.inputTokens + s.cost.usage.cacheReadTokens + s.cost.usage.cacheWriteTokens : null,
        outputTokens: s.cost?.usage.outputTokens ?? null,
        cacheReadTokens: s.cost?.usage.cacheReadTokens ?? null,
      })),
      toolCalls: p.toolCalls.map((t) => ({ name: t.name, ...describeTool(t.name, t.input, t.output) })),
      costUsd: p.totals.costUsd,
      ms: p.totals.ms,
      check: {
        correct: row ? row.problems.length === 0 : true,
        expectedRoute: (labels.get(p.emailId)?.route ?? d.route) as DemoEmail["route"],
        problems: row?.problems ?? [],
        purpose: labels.get(p.emailId)?.purpose ?? "",
      },
    };
  });

const LABELS: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
};

const comparison: ModelComparison[] = [];
for (const file of live ? [`${base}.test.json`, ...(args.compare?.split(",") ?? [])] : []) {
  const r = JSON.parse(await readFile(path.resolve(file), "utf8"));
  const m = r.metrics;
  comparison.push({
    model: m.model,
    label: LABELS[m.model] ?? m.model,
    orderLinesExact: m.orderLinesExact.pct,
    wrongOrdersCreated: m.wrongOrdersCreated,
    routeAccuracy: m.routeAccuracy,
    costPerEmailUsd: m.costPerEmailUsd,
    latencyP50Ms: m.latencyMs.p50,
  });
}

// What the real checks did with the week. Counts only.
const routes: Record<RouteName, number> = { create_draft: 0, needs_review: 0, not_an_order: 0 };
const reasonCount = new Map<string, { count: number; example: string }>();
for (const e of emails) {
  routes[e.route]++;
  for (const reason of new Set(e.issues.map((i) => i.reason))) {
    const r = reasonCount.get(reason) ?? { count: 0, example: e.id };
    r.count++;
    reasonCount.set(reason, r);
  }
}
const week: WeekSummary = {
  emails: emails.length,
  routes,
  reasons: [...reasonCount.entries()]
    .map(([reason, r]) => ({ reason, ...r }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  contactDetailsMasked: emails.reduce((s, e) => s + e.maskSpans.length, 0),
  lookups: emails.reduce((s, e) => s + e.toolCalls.length, 0),
};

const demo: DemoData = {
  generatedAt: new Date().toISOString(),
  mode: live ? "live" : "sample",
  week,
  metrics: live ? test.metrics : null,
  comparison: comparison.length > 1 ? comparison : [],
  failures: (test.rows as Row[]).filter((r) => r.problems.length).map((r) => ({ id: r.id, purpose: r.purpose, problems: r.problems })),
  emails,
};

const out = path.join(REPO_ROOT, "apps", "web", "src", "data", "demo.json");
await writeFile(out, JSON.stringify(demo));
console.log(`wrote ${path.relative(REPO_ROOT, out)}: ${emails.length} emails, ${(JSON.stringify(demo).length / 1024).toFixed(0)} KB`);
