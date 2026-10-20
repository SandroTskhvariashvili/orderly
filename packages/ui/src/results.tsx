import { pct, REASON_LABEL, seconds, usd } from "./format.ts";
import type { DemoData } from "./types.ts";

export function HeadlineNumbers({ data, size = "lg" }: { data: DemoData; size?: "lg" | "xl" }) {
  const m = data.metrics;
  const w = data.week;
  const flagged = w.reasons.find((r) => r.reason === "suspicious_instructions")?.count ?? 0;
  const items =
    data.mode === "live" && m
      ? [
          { value: String(m.wrongOrdersCreated), label: "wrong orders created" },
          { value: pct(m.orderLinesExact.pct), label: "of orders read line-perfect" },
          { value: pct(m.handledWithoutAPerson), label: "of all emails became correct drafts" },
          { value: usd(m.costPerEmailUsd), label: "per email, all steps" },
        ]
      : [
          { value: String(w.emails), label: "emails in one week" },
          { value: String(w.routes.create_draft), label: "became draft orders" },
          { value: String(w.routes.needs_review), label: "went to a person, with the reason" },
          { value: String(flagged), label: "attempts to instruct the system, stopped" },
        ];
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col-reverse border-t border-line-strong pt-3">
          <dt className="mt-2 text-[13px] text-fg-2">{it.label}</dt>
          <dd
            className={`tabular font-medium tracking-[-0.03em] text-fg ${
              size === "xl" ? "text-[64px] leading-none" : "text-[48px] leading-none"
            }`}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function WeekBreakdown({ data, onPick }: { data: DemoData; onPick?: (emailId: string) => void }) {
  const w = data.week;
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <caption className="sr-only">Why emails went to a person</caption>
      <thead>
        <tr className="border-b border-line-strong text-[11px] uppercase tracking-[0.08em] text-fg-3">
          <th className="py-2 pr-4 font-medium">Reason a person was asked</th>
          <th className="py-2 pr-4 text-right font-medium">Emails</th>
          <th className="py-2 font-medium">Example</th>
        </tr>
      </thead>
      <tbody>
        {w.reasons.map((r) => (
          <tr key={r.reason} className="border-b border-line">
            <th scope="row" className={`py-3 pr-4 font-normal ${r.reason === "suspicious_instructions" ? "text-rose" : "text-fg"}`}>
              {REASON_LABEL[r.reason] ?? r.reason}
            </th>
            <td className="tabular py-3 pr-4 text-right text-fg">{r.count}</td>
            <td className="py-3">
              {onPick ? (
                <button type="button" onClick={() => onPick(r.example)} className="tabular text-[13px] text-fg underline decoration-fg-3 underline-offset-4 hover:decoration-fg">
                  {r.example}
                </button>
              ) : (
                <a href={`#${r.example}`} className="tabular text-[13px] text-fg underline decoration-fg-3 underline-offset-4 hover:decoration-fg">
                  Open {r.example}
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MetricsTable({ data }: { data: DemoData }) {
  const m = data.metrics;
  if (!m) return null;
  const rows: Array<[string, string, string]> = [
    ["Wrong orders created", String(m.wrongOrdersCreated), "An email turned into a draft that does not match what the customer asked for."],
    ["Order lines exactly right", `${pct(m.orderLinesExact.pct)} of ${m.orderLinesExact.of}`, "Every product, quantity and unit matches the answer key."],
    ["Line precision / recall", `${pct(m.linePrecision)} / ${pct(m.lineRecall)}`, "Lines it added that were wrong / lines it missed."],
    ["Sorted correctly", pct(m.intentAccuracy), "Order, change, cancellation, question, complaint or not business."],
    ["Routed correctly", pct(m.routeAccuracy), "Draft, review or not an order, as a careful person would decide."],
    ["Delivery date right", pct(m.deliveryDateCorrect), "Including day names, the 14:00 cutoff and each customer's delivery days."],
    ["Problem emails caught", pct(m.reviewsCaught), "Emails that should go to a person, and did."],
    ["Reviews that were needed", pct(m.reviewsJustified), "How often a flag was worth a person's time."],
    ["Prompt injection contained", m.injectionContained, "Emails that tried to instruct the system. None were followed."],
    ["Cost per email", usd(m.costPerEmailUsd), "Every model call for that email, at list prices."],
    ["Time per email", `${seconds(m.latencyMs.p50)} median`, `${seconds(m.latencyMs.p95)} for the slowest 5%.`],
  ];
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <caption className="sr-only">Evaluation results</caption>
      <thead>
        <tr className="border-b border-line-strong text-[11px] uppercase tracking-[0.08em] text-fg-3">
          <th className="py-2 pr-4 font-medium">Measure</th>
          <th className="py-2 pr-4 font-medium">Result</th>
          <th className="hidden py-2 font-medium md:table-cell">What it means</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v, d]) => (
          <tr key={k} className="border-b border-line align-baseline">
            <th scope="row" className="py-3 pr-4 font-normal text-fg">
              {k}
            </th>
            <td className="tabular whitespace-nowrap py-3 pr-4 text-fg">{v}</td>
            <td className="hidden py-3 text-[13px] text-fg-3 md:table-cell">{d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ComparisonTable({ data }: { data: DemoData }) {
  if (!data.comparison.length) return null;
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <caption className="sr-only">Same evaluation on three models</caption>
      <thead>
        <tr className="border-b border-line-strong text-[11px] uppercase tracking-[0.08em] text-fg-3">
          <th className="py-2 pr-4 font-medium">Model</th>
          <th className="py-2 pr-4 font-medium">Lines exact</th>
          <th className="py-2 pr-4 font-medium">Wrong orders</th>
          <th className="py-2 pr-4 font-medium">Per email</th>
          <th className="py-2 font-medium">Median time</th>
        </tr>
      </thead>
      <tbody>
        {data.comparison.map((c) => (
          <tr key={c.model} className="border-b border-line">
            <th scope="row" className="py-3 pr-4 font-normal text-fg">
              {c.label}
              <span className="tabular ml-2 text-[11.5px] text-fg-3">{c.model}</span>
            </th>
            <td className="tabular py-3 pr-4">{pct(c.orderLinesExact)}</td>
            <td className={`tabular py-3 pr-4 ${c.wrongOrdersCreated ? "text-rose" : ""}`}>{c.wrongOrdersCreated}</td>
            <td className="tabular py-3 pr-4">{usd(c.costPerEmailUsd, 4)}</td>
            <td className="tabular py-3">{seconds(c.latencyP50Ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FailuresTable({ data }: { data: DemoData }) {
  if (!data.failures.length) return <p className="text-fg-2">It matched the answer key on every held-out email.</p>;
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <caption className="sr-only">Emails where the result did not match the answer key</caption>
      <thead>
        <tr className="border-b border-line-strong text-[11px] uppercase tracking-[0.08em] text-fg-3">
          <th className="py-2 pr-4 font-medium">Email</th>
          <th className="py-2 pr-4 font-medium">What it tests</th>
          <th className="py-2 font-medium">What happened</th>
        </tr>
      </thead>
      <tbody>
        {data.failures.map((f) => (
          <tr key={f.id} className="border-b border-line align-baseline">
            <td className="tabular whitespace-nowrap py-3 pr-4 text-fg-2">{f.id}</td>
            <td className="py-3 pr-4 text-fg">{f.purpose}</td>
            <td className="py-3 text-[13px] text-fg-2">{f.problems.join("; ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
