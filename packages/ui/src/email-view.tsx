import { FileText, ShieldCheck } from "lucide-react";
import { dayTime } from "./format.ts";
import type { DemoEmail, Span } from "./types.ts";

export type View = "original" | "masked";

interface Mark {
  start: number;
  end: number;
  line: number; // -1 for the delivery date
}

function marksFor(email: DemoEmail, source: Span["source"]): Mark[] {
  const marks: Mark[] = [];
  email.lines.forEach((l, i) => {
    if (l.evidence?.source === source) marks.push({ start: l.evidence.start, end: l.evidence.end, line: i });
  });
  if (email.deliveryEvidence?.source === source) {
    marks.push({ start: email.deliveryEvidence.start, end: email.deliveryEvidence.end, line: -1 });
  }
  // Drop overlaps so nesting never breaks the markup.
  return marks
    .sort((a, b) => a.start - b.start)
    .filter((m, i, all) => i === 0 || m.start >= all[i - 1]!.end);
}

function Highlighted({
  text,
  marks,
  active,
  onHover,
}: {
  text: string;
  marks: Mark[];
  active: number | null;
  onHover?: (line: number | null) => void;
}) {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start > cursor) out.push(<Quoted key={`t${cursor}`} text={text.slice(cursor, m.start)} />);
    const on = active === m.line;
    out.push(
      <mark
        key={`m${m.start}`}
        data-line={m.line}
        onMouseEnter={onHover ? () => onHover(m.line) : undefined}
        onMouseLeave={onHover ? () => onHover(null) : undefined}
        className={`rounded-[3px] px-[1px] text-fg transition-colors duration-150 ${
          on
            ? "bg-accent/35 shadow-[0_0_0_1px_var(--color-accent-bright)]"
            : "bg-accent-soft shadow-[inset_0_-1px_0_var(--color-accent)]"
        }`}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  }
  if (cursor < text.length) out.push(<Quoted key={`t${cursor}`} text={text.slice(cursor)} />);
  return <>{out}</>;
}

/** Dims quoted reply lines, the way a mail client does. */
function Quoted({ text }: { text: string }) {
  if (!text.includes("\n>") && !text.startsWith(">")) return <>{text}</>;
  return (
    <>
      {text.split(/(?<=\n)/).map((line, i) =>
        line.startsWith(">") ? (
          <span key={i} className="text-fg-4">
            {line}
          </span>
        ) : (
          <span key={i}>{line}</span>
        ),
      )}
    </>
  );
}

function MaskedText({ text }: { text: string }) {
  const parts = text.split(/(\[(?:EMAIL|PHONE|IBAN|ADDRESS|POSTCODE)_\d+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[(EMAIL|PHONE|IBAN|ADDRESS|POSTCODE)_\d+\]$/.test(p) ? (
          <span key={i} className="rounded-[4px] bg-hover px-1 py-px font-mono text-[12px] text-fg-2">
            {p}
          </span>
        ) : (
          <Quoted key={i} text={p} />
        ),
      )}
    </>
  );
}

export function EmailView({
  email,
  view,
  onViewChange,
  activeLine,
  onHoverLine,
}: {
  email: DemoEmail;
  view: View;
  onViewChange?: (v: View) => void;
  activeLine: number | null;
  onHoverLine?: (line: number | null) => void;
}) {
  return (
    <article className="flex min-h-0 flex-col" aria-label={`Email: ${email.subject}`}>
      <header className="border-b border-line px-6 pb-4 pt-5">
        <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg">{email.subject || "(no subject)"}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="font-medium text-fg">{email.from.name || email.from.address}</span>
          <span className="text-fg-3">{email.from.address}</span>
          <span className="tabular text-[12px] text-fg-3">{dayTime(email.receivedAt)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {email.customer ? (
            <span className="inline-flex items-center gap-2 text-[12.5px] text-fg-2">
              <span className="tabular rounded-[4px] bg-hover px-1.5 py-px text-[11px] text-fg-2">{email.customer.id}</span>
              {email.customer.name}
              <span className="text-fg-4">·</span>
              <span className="text-fg-3">{email.customer.city}</span>
            </span>
          ) : (
            <span className="text-[12.5px] text-amber">Sender not on file</span>
          )}
          <div role="tablist" aria-label="Email view" className="flex rounded-[7px] border border-line bg-panel p-0.5 text-[12px]">
            {(["original", "masked"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => onViewChange?.(v)}
                className={`rounded-[5px] px-2.5 py-1 transition-colors duration-150 ${
                  view === v ? "bg-hover text-fg" : "text-fg-3 hover:text-fg-2"
                }`}
              >
                {v === "original" ? "Original" : "What the model saw"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {view === "masked" && (
          <p className="mb-4 flex items-center gap-2 text-[12.5px] text-fg-3">
            <ShieldCheck className="size-3.5 text-accent" aria-hidden />
            {email.maskSpans.length
              ? `${email.maskSpans.length} contact detail${email.maskSpans.length > 1 ? "s" : ""} replaced before any model call.`
              : "No contact details in this email."}
          </p>
        )}
        <div className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.7] text-fg/90">
          {view === "masked" ? (
            <MaskedText text={email.maskedBody} />
          ) : (
            <Highlighted text={email.body} marks={marksFor(email, "body")} active={activeLine} onHover={onHoverLine} />
          )}
        </div>

        {email.attachments.map((a, i) => (
          <section key={a.filename} className="mt-6 overflow-hidden rounded-[10px] border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 text-[12.5px] text-fg-2">
              <FileText className="size-3.5 text-fg-3" aria-hidden />
              {a.filename}
              <span className="ml-auto text-fg-4">text read from the PDF</span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-fg-2">
              <Highlighted text={a.text} marks={marksFor(email, `attachment:${i}`)} active={activeLine} onHover={onHoverLine} />
            </pre>
          </section>
        ))}
      </div>
    </article>
  );
}
