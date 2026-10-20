import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 4 });
  return client;
}

export type Effort = "low" | "medium" | "high";

/**
 * Server-side fallback on a policy decline. Haiku has no fallback model, and
 * sending the parameter there would be pointless, so it is left off.
 */
export function fallbackParams(model: string): { betas: string[]; fallbacks?: "default" } {
  if (model.startsWith("claude-haiku")) return { betas: [] };
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

export class Declined extends Error {
  constructor(public readonly step: string, public readonly category: string | null) {
    super(`${step}: model declined (${category ?? "no category"})`);
  }
}
