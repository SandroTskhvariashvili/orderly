// USD per million tokens. Cache writes use the 5-minute TTL rate (1.25x input).
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  // Haiku cache-read price not published in our reference; assumed 0.1x input like the others' ratio.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export function fromApiUsage(u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): Usage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
}

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model];
  if (!p) throw new Error(`no price for ${model}`);
  const usd =
    (u.inputTokens * p.input +
      u.cacheWriteTokens * p.input * 1.25 +
      u.cacheReadTokens * p.cacheRead +
      u.outputTokens * p.output) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
