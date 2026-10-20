import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DATA_DIR } from "./fixtures.ts";
import { Extraction, ReplyDraft, Triage } from "./steps.ts";

// Recorded model output, one file per email in data/samples. In sample mode
// the pipeline replays these instead of calling the API. Everything else
// still runs for real: the lookups execute against the catalog and order
// history, and the checks, routing and masking are the production code.

export const Lookup = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("search_catalog"), query: z.string() }),
  z.object({ tool: z.literal("get_recent_orders"), limit: z.number().int().min(1).max(5) }),
  z.object({ tool: z.literal("get_open_orders") }),
  z.object({ tool: z.literal("find_customer"), query: z.string() }),
]);
export type Lookup = z.infer<typeof Lookup>;

export const Sample = z.object({
  emailId: z.string(),
  triage: Triage,
  lookups: z.array(Lookup),
  extraction: Extraction.nullable(),
  reply: ReplyDraft.nullable(),
});
export type Sample = z.infer<typeof Sample>;

export async function loadSamples(dir = path.join(DATA_DIR, "samples")): Promise<Map<string, Sample>> {
  const out = new Map<string, Sample>();
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort()) {
    const s = Sample.parse(JSON.parse(await readFile(path.join(dir, f), "utf8")));
    out.set(s.emailId, s);
  }
  return out;
}
