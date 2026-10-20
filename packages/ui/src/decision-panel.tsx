import { CornerDownRight, History, Mail } from "lucide-react";
import { INTENT_LABEL, REASON_LABEL, shortDate } from "./format.ts";
import { ReasonTag, RoutePill } from "./pills.tsx";
import type { DemoEmail } from "./types.ts";

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function verdict(e: DemoEmail): string {
  if (e.route === "create_draft") return "Every check passed. A draft order is waiting in the system.";
  if (e.route === "not_an_order") return `${INTENT_LABEL[e.intent] ?? e.intent}. Nothing to enter. ${e.summary}`;
  const n = e.issues.length;
  return `${n} thing${n > 1 ? "s" : ""} to check before this becomes an order.`;
}

export function DecisionPanel({
  email,
  activeLine,
  onHoverLine,
}: {
  email: DemoEmail;
  activeLine: number | null;
  onHoverLine?: (line: number | null) => void;
}) {
  const lineIssues = new Map<number, string[]>();
  for (const i of email.issues) if (i.line != null) lineIssues.set(i.line, [...(lineIssues.get(i.line) ?? []), i.reason]);
  const general = email.issues.filter((i) => i.line == null);

  return (
    <div className="flex flex-col">
      <div className="border-b border-line px-5 pb-4 pt-5">
        <RoutePill route={email.route} size="md" />
        <p className="mt-3 text-[14px] leading-relaxed text-fg">{verdict(email)}</p>
      </div>

      {email.issues.length > 0 && (
        <Section title="For the reviewer">
          <ul className="space-y-2.5">
            {email.issues.map((i, k) => (
              <li
                key={k}
                onMouseEnter={i.line != null && onHoverLine ? () => onHoverLine(i.line!) : undefined}
                onMouseLeave={i.line != null && onHoverLine ? () => onHoverLine(null) : undefined}
                className="text-[13px] leading-snug text-fg-2"
              >
                <ReasonTag reason={i.reason} />
                <p className="mt-1">{i.message}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {email.lines.length > 0 && (
        <Section
          title={email.route === "create_draft" ? "Draft order" : "What it read"}
          aside={<span className="text-[11.5px] text-fg-4">hover a line to see its source</span>}
        >
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Order lines</caption>
            <thead className="sr-only">
              <tr>
                <th>Quantity</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {email.lines.map((l, i) => {
                const issues = lineIssues.get(i);
                const on = activeLine === i;
                return (
                  <tr
                    key={i}
                    onMouseEnter={onHoverLine ? () => onHoverLine(i) : undefined}
                    onMouseLeave={onHoverLine ? () => onHoverLine(null) : undefined}
                    className={`cursor-default align-top transition-colors duration-150 ${on ? "bg-hover" : ""}`}
                  >
                    <td
                      className={`tabular w-[74px] border-l-2 py-2 pl-2 pr-3 text-right text-[13px] ${
                        issues ? "border-amber text-amber" : on ? "border-accent-bright text-fg" : "border-transparent text-fg"
                      }`}
                    >
                      {l.qty ?? "?"}
                      <span className="ml-1 text-fg-3">{l.unit ?? ""}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="text-fg">{l.name ?? <span className="text-amber">“{l.said}”</span>}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-fg-3">
                        {l.sku && <span className="tabular">{l.sku}</span>}
                        {l.packSize && <span>{l.packSize}</span>}
                      </div>
                      {l.conversion && (
                        <div className="mt-1 flex items-start gap-1 text-[11.5px] text-fg-3">
                          <CornerDownRight className="mt-[3px] size-3 shrink-0" aria-hidden />
                          {l.conversion}
                        </div>
                      )}
                      {l.candidates.length > 1 && (
                        <div className="mt-1 text-[11.5px] text-amber">Could be: {l.candidates.map((c) => c.name).join(" / ")}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {(email.deliveryDate || email.basedOnOrderId || email.refersToOrderId) && (
        <Section title="Context">
          <dl className="space-y-2 text-[13px]">
            {email.deliveryDate && (
              <div
                className="flex items-baseline justify-between gap-4"
                onMouseEnter={email.deliveryEvidence && onHoverLine ? () => onHoverLine(-1) : undefined}
                onMouseLeave={email.deliveryEvidence && onHoverLine ? () => onHoverLine(null) : undefined}
              >
                <dt className="text-fg-3">Delivery</dt>
                <dd className={`tabular ${email.issues.some((i) => i.reason === "invalid_delivery_date") ? "text-amber" : "text-fg"}`}>
                  {shortDate(email.deliveryDate)}
                  {!email.requestedDeliveryDate && <span className="ml-2 font-sans text-fg-3">next delivery day</span>}
                </dd>
              </div>
            )}
            {email.basedOnOrderId && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-fg-3">
                  <History className="size-3.5" aria-hidden />
                  Built from
                </dt>
                <dd className="tabular text-fg">{email.basedOnOrderId}</dd>
              </div>
            )}
            {email.refersToOrderId && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-fg-3">Changes order</dt>
                <dd className="tabular text-fg">{email.refersToOrderId}</dd>
              </div>
            )}
            {email.changeSummary && <p className="pt-1 text-[12.5px] leading-snug text-fg-2">{email.changeSummary}</p>}
          </dl>
        </Section>
      )}

      {email.reply && (
        <Section title="Reply draft" aside={<span className="text-[11.5px] text-fg-4">not sent</span>}>
          <div className="rounded-[10px] border border-line bg-panel">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12.5px] text-fg-2">
              <Mail className="size-3.5 text-fg-3" aria-hidden />
              {email.reply.subject}
            </div>
            <p className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed text-fg-2">{email.reply.body}</p>
          </div>
        </Section>
      )}

      <Section title="Answer key">
        {email.check.correct ? (
          <p className="text-[12.5px] text-fg-2">
            <span className="text-accent-bright">Matches.</span> {email.check.purpose}
          </p>
        ) : (
          <div className="text-[12.5px] leading-snug text-fg-2">
            <span className="text-rose">Does not match.</span> {email.check.purpose}
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-fg-3">
              {email.check.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {general.length === 0 && email.issues.length === 0 && email.route === "needs_review" && (
          <p className="mt-1 text-fg-3">{REASON_LABEL.low_confidence}</p>
        )}
      </Section>
    </div>
  );
}
