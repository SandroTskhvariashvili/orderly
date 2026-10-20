"use client";

import { FileText, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { dayTime } from "./format.ts";
import type { DemoEmail, Span } from "./types.ts";

export type View = "original" | "masked";

interface Mark {
  start: number;
  end: number;
  line: number; // -1 for the delivery date, -2 for text aimed at the system
}

function marksFor(email: DemoEmail, source: Span["source"]): Mark[] {
  const marks: Mark[] = [];
  email.lines.forEach((l, i) => {
    if (l.evidence?.source === source) marks.push({ start: l.evidence.start, end: l.evidence.end, line: i });
  });
  if (email.deliveryEvidence?.source === source) {
    marks.push({ start: email.deliveryEvidence.start, end: email.deliveryEvidence.end, line: -1 });
  }
  for (const f of email.flagged ?? []) if (f.source === source) marks.push({ start: f.start, end: f.end, line: -2 });
  // Drop overlaps so nesting never breaks the markup.
  return marks
    .sort((a, b) => a.start - b.start)
    .filter((m, i, all) => i === 0 || m.start >= all[i - 1]!.end);
}

function Highlighted({ text, marks, active, idPrefix }: { text: string; marks: Mark[]; active: number | null; idPrefix: string }) {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start > cursor) out.push(<Quoted key={`t${cursor}`} text={text.slice(cursor, m.start)} />);
    const slice = text.slice(m.start, m.end);
    if (m.line === -2) {
      out.push(
        <mark
          key={`m${m.start}`}
          data-flagged
          className="rounded-[3px] bg-rose-soft px-[1px] text-rose underline decoration-rose decoration-dashed decoration-1 underline-offset-[3px]"
        >
          <span className="sr-only">Flagged instruction, not followed: </span>
          {slice}
        </mark>,
      );
    } else {
      const on = active === m.line;
      out.push(
        <mark
          key={`m${m.start}`}
          id={`${idPrefix}-src-${m.line}`}
          data-line={m.line}
          className={`rounded-[3px] px-[1px] text-fg transition-colors duration-150 ${
            on
              ? "bg-accent/35 shadow-[0_0_0_1px_var(--color-accent-bright)]"
              : "bg-accent-soft shadow-[inset_0_-1px_0_var(--color-accent)]"
          }`}
        >
          {slice}
        </mark>,
      );
    }
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
          <span key={i} className="text-fg-3">
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

/** Scrolls a child into view inside its own pane, never the window. */
function revealIn(container: HTMLElement | null, el: Element | null | undefined) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < c.top + 24) container.scrollTop += r.top - c.top - 24;
  else if (r.bottom > c.bottom - 24) container.scrollTop += r.bottom - c.bottom + 24;
}

export function EmailView({
  email,
  view,
  onViewChange,
  activeLine,
}: {
  email: DemoEmail;
  view: View;
  onViewChange?: (v: View) => void;
  activeLine: number | null;
}) {
  const pane = useRef<HTMLDivElement>(null);
  const idPrefix = `ev-${email.id}`;

  useEffect(() => {
    if (activeLine == null) return;
    revealIn(pane.current, pane.current?.querySelector(`mark[data-line="${activeLine}"]`));
  }, [activeLine, email.id]);

  useEffect(() => {
    const p = pane.current;
    if (!p) return;
    p.scrollTop = 0;
    revealIn(p, p.querySelector("mark[data-flagged]"));
  }, [email.id]);

  return (
    <article className="flex min-h-0 flex-col" aria-label={`Email: ${email.subject}`}>
      <header className="border-b border-line px-6 pb-4 pt-5">
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg">{email.subject || "(no subject)"}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="font-medium text-fg">{email.from.name || email.from.address}</span>
          <span className="text-fg-3">{email.from.address}</span>
          <span className="tabular text-[12px] text-fg-3">{dayTime(email.receivedAt)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {email.customer ? (
            <span className="inline-flex items-center gap-2 text-[12.5px] text-fg-2">
              <span className="tabular whitespace-nowrap rounded-[4px] bg-hover px-1.5 py-px text-[11px] text-fg-2">{email.customer.id}</span>
              {email.customer.name}
              <span className="text-fg-3" aria-hidden>
                ·
              </span>
              <span className="text-fg-3">{email.customer.city}</span>
            </span>
          ) : (
            <span className="text-[12.5px] text-amber">Sender not on file</span>
          )}
          <div role="group" aria-label="Email view" className="flex rounded-[7px] border border-line bg-panel p-0.5 text-[12px]">
            {(["original", "masked"] as const).map((v) => (
              <button
                key={v}
                type="button"
                data-view-tab={v}
                aria-pressed={view === v}
                onClick={() => onViewChange?.(v)}
                className={`rounded-[5px] px-2.5 py-1 transition-colors duration-150 ${
                  view === v ? "bg-hover text-fg shadow-[inset_0_-2px_0_var(--color-accent-bright)]" : "text-fg-3 hover:text-fg-2"
                }`}
              >
                {v === "original" ? "Original" : "What the model saw"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div ref={pane} tabIndex={0} aria-label="Email body" className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5 outline-offset-[-2px]">
        {view === "masked" && (
          <p role="status" className="mb-4 flex items-center gap-2 text-[12.5px] text-fg-3">
            <ShieldCheck className="size-3.5 text-accent" aria-hidden />
            {email.maskSpans.length
              ? `${email.maskSpans.length} contact detail${email.maskSpans.length > 1 ? "s" : ""} replaced before any model call.`
              : "No contact details in this email."}
          </p>
        )}
        <div lang={email.language} data-email-body className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.7] text-fg/90">
          {view === "masked" ? (
            <MaskedText text={email.maskedBody} />
          ) : (
            <Highlighted text={email.body} marks={marksFor(email, "body")} active={activeLine} idPrefix={idPrefix} />
          )}
        </div>

        {email.attachments.map((a, i) => (
          <section key={a.filename} className="mt-6 overflow-hidden rounded-[10px] border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 text-[12.5px] text-fg-2">
              <FileText className="size-3.5 text-fg-3" aria-hidden />
              {a.filename}
              <span className="ml-auto text-fg-3">text read from the PDF</span>
            </div>
            <pre lang={email.language} className="whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-fg-2">
              <Highlighted text={a.text} marks={marksFor(email, `attachment:${i}`)} active={activeLine} idPrefix={`${idPrefix}-a${i}`} />
            </pre>
          </section>
        ))}
      </div>
    </article>
  );
}
