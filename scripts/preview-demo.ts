// Builds a PREVIEW demo.json from the answer keys, as if the pipeline were
// perfect. Only for working on the UI before a real run exists. It writes to
// apps/web/src/data/demo.json and marks itself as a preview; `pnpm publish:demo`
// overwrites it with real results. Never ship a preview.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, Label, loadMasterData, mask, nextDeliveryDate, readEml, REPO_ROOT } from "@orderly/core";
import type { DemoData, DemoEmail } from "../packages/ui/src/types.ts";

const data = await loadMasterData();
const files = (await readdir(path.join(DATA_DIR, "inbox"))).filter((f) => f.endsWith(".eml")).sort();

const emails: DemoEmail[] = [];
for (const f of files) {
  const id = f.replace(".eml", "");
  const email = await readEml(path.join(DATA_DIR, "inbox", f), id);
  const label = Label.parse(JSON.parse(await readFile(path.join(DATA_DIR, "labels", `${id}.json`), "utf8")));
  const customer = label.customerId ? data.customerById.get(label.customerId) ?? null : null;
  const m = mask(email.text);
  emails.push({
    id,
    split: label.split,
    receivedAt: email.receivedAt,
    from: email.from,
    subject: email.subject,
    body: email.text,
    maskedBody: m.text,
    maskSpans: m.spans,
    attachments: email.attachments.map((a) => ({ filename: a.filename, text: a.text })),
    customer: customer ? { id: customer.id, name: customer.name, city: customer.city } : null,
    intent: label.intent,
    summary: label.purpose,
    route: label.route,
    issues: label.reasons.map((r) => ({ reason: r, message: `PREVIEW: ${label.purpose}` })),
    lines: label.lines.map((l) => {
      const p = data.productBySku.get(l.sku)!;
      return { qty: l.qty, unit: l.unit, sku: l.sku, name: p.name, packSize: p.packSize, said: "", evidence: null, conversion: null, candidates: [] };
    }),
    deliveryDate: label.deliveryDate ?? (customer && label.intent === "new_order" ? nextDeliveryDate(email.receivedAt, customer.deliveryDays) : null),
    requestedDeliveryDate: null,
    deliveryEvidence: null,
    basedOnOrderId: null,
    refersToOrderId: label.refersToOrderId,
    changeSummary: null,
    reply: null,
    steps: [{ name: "read", ms: 12, note: "PREVIEW", model: null, costUsd: null, inputTokens: null, outputTokens: null, cacheReadTokens: null }],
    toolCalls: [],
    costUsd: 0,
    ms: 0,
    check: { correct: true, expectedRoute: label.route, problems: [], purpose: label.purpose },
  });
}

const preview: DemoData = {
  generatedAt: `PREVIEW ${new Date().toISOString()}`,
  metrics: {
    model: "PREVIEW",
    split: "test",
    emails: 40,
    wrongOrdersCreated: 0,
    intentAccuracy: null,
    routeAccuracy: null,
    orderLinesExact: { pct: null, of: 0 },
    linePrecision: null,
    lineRecall: null,
    deliveryDateCorrect: null,
    handledWithoutAPerson: 50,
    cleanOrdersAutomated: null,
    reviewsCaught: null,
    reviewsJustified: null,
    injectionContained: "-",
    costPerEmailUsd: 0,
    totalCostUsd: 0,
    latencyMs: { p50: 0, p95: 0 },
  },
  comparison: [],
  failures: [],
  emails,
};
await writeFile(path.join(REPO_ROOT, "apps/web/src/data/demo.json"), JSON.stringify(preview));
console.log(`PREVIEW demo.json written with ${emails.length} emails`);
