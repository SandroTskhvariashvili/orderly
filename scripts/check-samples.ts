// Replays data/samples through the real pipeline (no API calls) and compares
// the outcome with the answer keys. Run with `pnpm check:samples`.
//
//   pnpm check:samples              all emails
//   pnpm check:samples E-003 E-009  just these, with full detail

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  analyze,
  DATA_DIR,
  decideFor,
  draftLines,
  Label,
  loadMasterData,
  loadSamples,
  replyFacts,
  type Analysis,
  type Brain,
  type PriorDraft,
} from "@orderly/core";

const only = new Set(process.argv.slice(2));
const data = await loadMasterData();
const samples = await loadSamples();
const brain: Brain = { kind: "sample", samples };

const ids = (await readdir(path.join(DATA_DIR, "inbox"))).filter((f) => f.endsWith(".eml")).map((f) => f.replace(".eml", "")).sort();
const labels = new Map<string, Label>();
for (const id of ids) labels.set(id, Label.parse(JSON.parse(await readFile(path.join(DATA_DIR, "labels", `${id}.json`), "utf8"))));

const errors: string[] = [];
const warnings: string[] = [];
const analyses: Analysis[] = [];
for (const id of ids) {
  if (!samples.has(id)) {
    errors.push(`${id}: no sample file`);
    continue;
  }
  try {
    analyses.push(await analyze(data, path.join(DATA_DIR, "inbox", `${id}.eml`), id, brain));
  } catch (err) {
    errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

analyses.sort((a, b) => a.email.receivedAt.localeCompare(b.email.receivedAt));
const prior: PriorDraft[] = [];
const key = (l: { sku: string; qty: number; unit: string }) => `${l.sku}|${l.qty}|${l.unit}`;
let ok = 0;

for (const a of analyses) {
  const id = a.email.id;
  const label = labels.get(id)!;
  const { decision } = decideFor(data, a, prior);
  if (a.triage.intent === "new_order" && a.customerId) {
    prior.push({ emailId: id, customerId: a.customerId, receivedAt: a.email.receivedAt, lines: draftLines(decision) });
  }

  const problems: string[] = [];
  const reasons = [...new Set(decision.issues.map((i) => i.reason))];
  if (a.triage.intent !== label.intent) problems.push(`intent ${a.triage.intent}, expected ${label.intent}`);
  if (decision.route !== label.route) problems.push(`route ${decision.route}, expected ${label.route}`);
  const missingReasons = label.reasons.filter((r) => !reasons.includes(r));
  if (missingReasons.length) problems.push(`missing reasons [${missingReasons.join(", ")}]`);
  const extra = reasons.filter((r) => !label.reasons.includes(r));
  if (extra.length) problems.push(`extra reasons [${extra.join(", ")}]: ${decision.issues.filter((i) => extra.includes(i.reason)).map((i) => i.message).join(" | ")}`);

  if (label.intent === "new_order") {
    const flagged = new Set(
      decision.issues.filter((i) => i.line != null && ["ambiguous_product", "unknown_product"].includes(i.reason)).map((i) => i.line),
    );
    const got = decision.lines
      .flatMap((l, i) => (l.sku && l.qty != null && l.unit && !flagged.has(i) ? [{ sku: l.sku, qty: l.qty, unit: l.unit }] : []))
      .map(key)
      .sort();
    const want = label.lines.map(key).sort();
    if (got.join() !== want.join()) {
      problems.push(`lines: missing [${want.filter((w) => !got.includes(w)).join(", ")}] extra [${got.filter((g) => !want.includes(g)).join(", ")}]`);
    }
  }
  if (label.route === "create_draft" && decision.deliveryDate !== label.deliveryDate) {
    problems.push(`delivery ${decision.deliveryDate}, expected ${label.deliveryDate}`);
  }
  if (label.refersToOrderId && a.extraction?.refers_to_order_id !== label.refersToOrderId) {
    problems.push(`refers_to_order_id ${a.extraction?.refers_to_order_id}, expected ${label.refersToOrderId}`);
  }

  const facts = replyFacts(data, a, decision);
  const sample = samples.get(id)!;
  if (facts && !sample.reply) problems.push(`needs a reply draft. Facts to write it from:\n${facts.replace(/^/gm, "      ")}`);
  if (!facts && sample.reply) warnings.push(`${id}: has a reply draft but none is needed (route ${decision.route})`);

  if (problems.length) errors.push(`${id} (${label.purpose})\n    - ${problems.join("\n    - ")}`);
  else ok++;

  if (only.has(id)) {
    console.log(`\n=== ${id}: ${decision.route} ${reasons.join(", ")}`);
    for (const i of decision.issues) console.log(`  issue  ${i.reason}: ${i.message}`);
    decision.lines.forEach((l, i) => console.log(`  line ${i}  ${l.qty} ${l.unit} ${l.sku}  said="${l.said}" ${l.evidence ? "found" : "NOT FOUND"}`));
    console.log(`  delivery ${decision.deliveryDate}`);
    if (facts) console.log(`  reply facts:\n${facts.replace(/^/gm, "    ")}`);
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${ok}/${ids.length} emails replay exactly as the answer key says`);
if (errors.length) process.exit(1);
