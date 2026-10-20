// Runs the inbox through the pipeline and saves everything the UI and the
// scorer need. Labels are read only to pick a split; the pipeline never sees them.
//
//   pnpm process                       all 60 emails, default model
//   pnpm process --split dev           the 20 tuning emails
//   pnpm process --only E-004,E-017    a few emails while debugging
//   pnpm process --model claude-sonnet-5-5
//   pnpm process --samples             replay recorded model output, no API calls

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import pLimit from "p-limit";
import {
  analyze,
  decideFor,
  DATA_DIR,
  DEFAULT_MODEL,
  draftLines,
  finish,
  loadMasterData,
  loadSamples,
  REPO_ROOT,
  type Analysis,
  type Brain,
  type PriorDraft,
  type ProcessedEmail,
} from "@orderly/core";

const { values: args } = parseArgs({
  options: {
    model: { type: "string", default: DEFAULT_MODEL },
    split: { type: "string", default: "all" },
    only: { type: "string" },
    concurrency: { type: "string", default: "4" },
    samples: { type: "boolean", default: false },
  },
});

const brain: Brain = args.samples ? { kind: "sample", samples: await loadSamples() } : { kind: "live", model: args.model! };
const model = brain.kind === "live" ? brain.model : "sample";
const data = await loadMasterData();
const inboxDir = path.join(DATA_DIR, "inbox");

let ids = (await readdir(inboxDir)).filter((f) => f.endsWith(".eml")).map((f) => f.replace(".eml", "")).sort();
if (args.only) {
  const only = new Set(args.only.split(","));
  ids = ids.filter((id) => only.has(id));
} else if (args.split !== "all") {
  const keep: string[] = [];
  for (const id of ids) {
    const label = JSON.parse(await readFile(path.join(DATA_DIR, "labels", `${id}.json`), "utf8"));
    if (label.split === args.split) keep.push(id);
  }
  ids = keep;
}

const runId = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}_${model}_${args.only ? "only" : args.split}`;
console.log(`run ${runId}: ${ids.length} emails`);

const limit = pLimit(Number(args.concurrency));
const errors: Array<{ emailId: string; error: string }> = [];
let done = 0;

// Phase 1: model work, in parallel.
const analyses = (
  await Promise.all(
    ids.map((id) =>
      limit(async () => {
        try {
          const a = await analyze(data, path.join(inboxDir, `${id}.eml`), id, brain);
          process.stdout.write(`\r  analysed ${++done}/${ids.length}`);
          return a;
        } catch (err) {
          errors.push({ emailId: id, error: err instanceof Error ? err.message : String(err) });
          return null;
        }
      }),
    ),
  )
).filter((a): a is Analysis => a !== null);
process.stdout.write("\n");

// Phase 2: decisions in arrival order, so duplicate checks only look backwards.
analyses.sort((a, b) => a.email.receivedAt.localeCompare(b.email.receivedAt));
const prior: PriorDraft[] = [];
const decided = analyses.map((a) => {
  const { decision, step } = decideFor(data, a, prior);
  if (a.triage.intent === "new_order" && a.customerId) {
    prior.push({ emailId: a.email.id, customerId: a.customerId, receivedAt: a.email.receivedAt, lines: draftLines(decision) });
  }
  return { a, decision, step };
});

// Phase 3: reply drafts, in parallel.
done = 0;
const processed = (
  await Promise.all(
    decided.map(({ a, decision, step }) =>
      limit(async () => {
        try {
          const p = await finish(data, a, decision, step, brain);
          process.stdout.write(`\r  finished ${++done}/${decided.length}`);
          return p;
        } catch (err) {
          errors.push({ emailId: a.email.id, error: err instanceof Error ? err.message : String(err) });
          return null;
        }
      }),
    ),
  )
).filter((p): p is ProcessedEmail => p !== null);
process.stdout.write("\n");

const total = processed.reduce((s, p) => s + p.totals.costUsd, 0);
const run = {
  runId,
  model,
  split: args.only ? `only:${args.only}` : args.split,
  createdAt: new Date().toISOString(),
  emails: processed,
  errors,
};

const dir = path.join(REPO_ROOT, "eval", "runs");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `${runId}.json`);
await writeFile(file, JSON.stringify(run, null, 2));

const routes = processed.reduce<Record<string, number>>((m, p) => ((m[p.decision.route] = (m[p.decision.route] ?? 0) + 1), m), {});
console.log(`routes  ${JSON.stringify(routes)}`);
console.log(brain.kind === "sample" ? "cost    none, recorded samples (no API calls)" : `cost    $${total.toFixed(4)} total, $${(total / Math.max(1, processed.length)).toFixed(4)} per email`);
for (const e of errors) console.log(`ERROR   ${e.emailId}: ${e.error}`);
console.log(`saved   ${path.relative(REPO_ROOT, file)}`);
