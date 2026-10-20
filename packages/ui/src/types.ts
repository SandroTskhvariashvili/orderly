// The published shape of one processed email. Produced by eval/src/publish.ts
// from a pipeline run plus its score, so the UI never needs the core package.

export type RouteName = "create_draft" | "needs_review" | "not_an_order";

export interface Span {
  source: "body" | `attachment:${number}`;
  start: number;
  end: number;
}

export interface DemoLine {
  qty: number | null;
  unit: string | null;
  sku: string | null;
  name: string | null;
  packSize: string | null;
  said: string;
  evidence: Span | null;
  conversion: string | null;
  candidates: Array<{ sku: string; name: string }>;
}

export interface DemoIssue {
  reason: string;
  message: string;
  line?: number;
}

export interface DemoStep {
  name: "read" | "mask" | "triage" | "extract" | "decide" | "reply";
  ms: number;
  note: string;
  /** Model output replayed from a recorded sample rather than a live call. */
  sample: boolean;
  model: string | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
}

export interface DemoToolCall {
  name: string;
  input: string;
  result: string;
}

export interface DemoEmail {
  id: string;
  split: "dev" | "test";
  receivedAt: string;
  from: { name: string; address: string };
  subject: string;
  body: string;
  maskedBody: string;
  maskSpans: Array<{ start: number; end: number; token: string; kind: string }>;
  attachments: Array<{ filename: string; text: string }>;
  customer: { id: string; name: string; city: string } | null;
  intent: string;
  /** Language the email is written in, for the lang attribute. */
  language: string;
  summary: string;
  route: RouteName;
  issues: DemoIssue[];
  lines: DemoLine[];
  deliveryDate: string | null;
  requestedDeliveryDate: string | null;
  deliveryEvidence: Span | null;
  /** Text aimed at the system, highlighted as a warning. */
  flagged: Span[];
  basedOnOrderId: string | null;
  refersToOrderId: string | null;
  changeSummary: string | null;
  reply: { subject: string; body: string } | null;
  steps: DemoStep[];
  toolCalls: DemoToolCall[];
  costUsd: number;
  ms: number;
  /** How this email scored against the hand-written answer key. */
  check: { correct: boolean; expectedRoute: RouteName; problems: string[]; purpose: string };
}

export interface DemoMetrics {
  model: string;
  split: string;
  emails: number;
  wrongOrdersCreated: number;
  intentAccuracy: number | null;
  routeAccuracy: number | null;
  orderLinesExact: { pct: number | null; of: number };
  linePrecision: number | null;
  lineRecall: number | null;
  deliveryDateCorrect: number | null;
  handledWithoutAPerson: number | null;
  cleanOrdersAutomated: number | null;
  reviewsCaught: number | null;
  reviewsJustified: number | null;
  injectionContained: string;
  costPerEmailUsd: number;
  totalCostUsd: number;
  latencyMs: { p50: number; p95: number };
}

export interface ModelComparison {
  model: string;
  label: string;
  orderLinesExact: number | null;
  wrongOrdersCreated: number;
  routeAccuracy: number | null;
  costPerEmailUsd: number;
  latencyP50Ms: number;
}

/** What the real checks did with this week's inbox. Counts, not accuracy claims. */
export interface WeekSummary {
  emails: number;
  routes: Record<RouteName, number>;
  reasons: Array<{ reason: string; count: number; example: string }>;
  contactDetailsMasked: number;
  lookups: number;
}

export interface DemoData {
  generatedAt: string;
  /** "sample": model output replayed from recordings. "live": a measured run against the API. */
  mode: "sample" | "live";
  week: WeekSummary;
  metrics: DemoMetrics | null;
  comparison: ModelComparison[];
  failures: Array<{ id: string; purpose: string; problems: string[] }>;
  emails: DemoEmail[];
}
