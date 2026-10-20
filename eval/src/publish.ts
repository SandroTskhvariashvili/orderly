// Turns a scored run into the JSON the website and the video read.
//
//   pnpm publish:demo --run eval/runs/<id>.json [--compare eval/reports/<a>.test.json,...]
//
// Expects `pnpm eval --run <file> --split all` and `--split test` to have been run first.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { REPO_ROOT, loadMasterData, type ProcessedEmail } from "@orderly/core";
import type { DemoData, DemoEmail, ModelComparison } from "../../packages/ui/src/types.ts";

const { values: args } = parseArgs({
  options: { run: { type: "string" }, compare: { type: "string" } },
});
if (!args.run) throw new Error("--run is required");

const runFile = path.resolve(args.run);
const base = path.join(REPO_ROOT, "eval", "reports", path.basename(runFile, ".json"));
const run = JSON.parse(await readFile(runFile, "utf8")) as { model: string; emails: ProcessedEmail[] };
const all = JSON.parse(await readFile(`${base}.all.json`, "utf8"));
const test = JSON.parse(await readFile(`${base}.test.json`, "utf8"));
const data = await loadMasterData();

type Row = { id: string; purpose: string; problems: string[]; expected: { route: string }; routeOk: boolean };
const rowById = new Map<string, Row>(all.rows.map((r: Row) => [r.id, r]));
const splitById = new Map<string, "dev" | "test">();
for (const r of test.rows as Row[]) splitById.set(r.id, "test");

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
      split: splitById.get(p.emailId) ?? "dev",
      receivedAt: p.receivedAt,
      from: p.from,
      subject: p.subject,
      body: p.body,
      maskedBody: p.maskedBody,
      maskSpans: p.maskSpans,
      attachments: p.attachments,
      customer: p.customer ? { id: p.customer.id, name: p.customer.name, city: p.customer.city } : null,
      intent: p.triage.intent,
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
      basedOnOrderId: p.extraction?.based_on_order_id ?? null,
      refersToOrderId: p.extraction?.refers_to_order_id ?? null,
      changeSummary: p.extraction?.change_summary ?? null,
      reply: p.reply,
      steps: p.steps.map((s) => ({
        name: s.name,
        ms: s.ms,
        note: s.note,
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
        expectedRoute: (row?.expected.route ?? d.route) as DemoEmail["route"],
        problems: row?.problems ?? [],
        purpose: row?.purpose ?? "",
      },
    };
  });

const LABELS: Record<string, string> = {
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
};

const comparison: ModelComparison[] = [];
for (const file of [`${base}.test.json`, ...(args.compare?.split(",") ?? [])]) {
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

const demo: DemoData = {
  generatedAt: new Date().toISOString(),
  metrics: test.metrics,
  comparison: comparison.length > 1 ? comparison : [],
  failures: (test.rows as Row[]).filter((r) => r.problems.length).map((r) => ({ id: r.id, purpose: r.purpose, problems: r.problems })),
  emails,
};

const out = path.join(REPO_ROOT, "apps", "web", "src", "data", "demo.json");
await writeFile(out, JSON.stringify(demo));
console.log(`wrote ${path.relative(REPO_ROOT, out)}: ${emails.length} emails, ${(JSON.stringify(demo).length / 1024).toFixed(0)} KB`);
