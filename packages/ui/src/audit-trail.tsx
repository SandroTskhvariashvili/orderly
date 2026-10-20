import { seconds, usd } from "./format.ts";
import type { DemoEmail, DemoStep } from "./types.ts";

const STEP_LABEL: Record<DemoStep["name"], string> = {
  read: "Read email",
  mask: "Mask contact details",
  triage: "Sort",
  extract: "Read the order",
  decide: "Check and route",
  reply: "Draft reply",
};

const BY_CODE = new Set(["read", "mask", "decide"]);

export function AuditTrail({ email }: { email: DemoEmail }) {
  return (
    <div className="px-5 py-5">
      <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
        {email.steps.map((s, i) => {
          const code = BY_CODE.has(s.name);
          return (
            <li key={i} className="relative pl-6">
              <span
                className={`absolute left-0 top-[5px] size-[11px] rounded-full border-2 ${
                  code ? "border-fg-4 bg-canvas" : "border-accent bg-accent-soft"
                }`}
                aria-hidden
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-fg">{STEP_LABEL[s.name]}</span>
                <span className="tabular shrink-0 text-[11.5px] text-fg-3">
                  {seconds(s.ms)}
                  {s.costUsd != null && <span className="ml-2 text-fg-2">{usd(s.costUsd, 4)}</span>}
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">{s.note}</p>
              <p className="mt-1 text-[11px] text-fg-4">
                {code ? (
                  "code, no model"
                ) : (
                  <span className="tabular">
                    {s.model} · {s.inputTokens?.toLocaleString("en-US")} in
                    {s.cacheReadTokens ? ` (${s.cacheReadTokens.toLocaleString("en-US")} cached)` : ""} ·{" "}
                    {s.outputTokens?.toLocaleString("en-US")} out
                  </span>
                )}
              </p>
              {s.name === "extract" && email.toolCalls.length > 0 && (
                <ul className="mt-2.5 space-y-1 border-l border-line pl-3">
                  {email.toolCalls.map((t, k) => (
                    <li key={k} className="font-mono text-[11.5px] leading-snug text-fg-3">
                      <span className="text-fg-2">{t.name}</span>({t.input}) <span className="text-fg-4">→</span> {t.result}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex items-baseline justify-between border-t border-line pt-3 text-[12.5px]">
        <span className="text-fg-3">This email</span>
        <span className="tabular text-fg">
          {seconds(email.ms)} · {usd(email.costUsd)}
        </span>
      </div>
    </div>
  );
}
