import { useRef } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Console, type DemoData, type DemoEmail, type Filter, type Pane, type View } from "@orderly/ui";
import demoJson from "../../web/src/data/demo.json";
import { Backdrop, Camera, Caption, Cursor, ease, FontRoot, type CursorKey, type Shot } from "./kit.tsx";
import { useStagePoints, type Point } from "./measure.ts";
import "./style.css";

export const FPS = 60;
export const s = (sec: number) => Math.round(sec * FPS);
export const DURATION = s(62);

const demo = demoJson as unknown as DemoData;
const byTime = [...demo.emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
const reviewList = byTime.filter((e) => e.route === "needs_review");
const VISIBLE = 9; // rows visible in the inbox list without scrolling

// The story picks its emails from the data, so it always shows what the pipeline produced.
const repeat =
  byTime.find((e) => e.basedOnOrderId && e.route === "create_draft" && e.lines.length >= 3 && /double|twice/i.test(e.body)) ??
  byTime.find((e) => e.basedOnOrderId && e.route === "create_draft")!;
const visibleReview = reviewList.slice(0, VISIBLE);
const clarify = visibleReview.find((e) => e.reply && e.issues.some((i) => i.reason === "ambiguous_product")) ?? visibleReview.find((e) => e.reply)!;
const injection = visibleReview.find((e) => e.flagged.length > 0)!;
const masked = visibleReview.filter((e) => e.id !== clarify.id && e.id !== injection.id).sort((a, b) => b.maskSpans.length - a.maskSpans.length)[0]!;

const messy: DemoEmail[] = [];
for (const pick of [
  (e: DemoEmail) => /oatmlk|espreso|carmel/i.test(e.body),
  (e: DemoEmail) => e.customer !== null && /bitte|Danke/.test(e.body) && e.route === "create_draft",
  (e: DemoEmail) => /por favor|gracias/i.test(e.body) && e.route === "create_draft",
]) {
  const found = byTime.find((e) => pick(e) && e.id !== repeat.id && !messy.includes(e));
  if (found) messy.push(found);
}

const STAGE = { w: 1600, h: 900 };

// ---------------------------------------------------------------------------

function MailCard({ email, lines = 16, width = 620 }: { email: DemoEmail; lines?: number; width?: number }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.14)]" style={{ width }}>
      <div className="border-b border-line px-7 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[20px] font-medium text-fg">{email.from.name || email.from.address}</span>
          <span className="tabular text-[15px] text-fg-3">
            {new Date(email.receivedAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}
          </span>
        </div>
        <div className="mt-1 text-[17px] text-fg-2">{email.subject || "(no subject)"}</div>
      </div>
      <div
        className="whitespace-pre-wrap px-7 py-5 text-[18px] leading-[1.6] text-fg/90"
        style={{ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {email.body}
      </div>
    </div>
  );
}

function MessyInbox() {
  const frame = useCurrentFrame();
  const layout = [
    { left: 140, top: 120, rotate: -2.6 },
    { left: 650, top: 70, rotate: 1.2 },
    { left: 1160, top: 140, rotate: -1.1 },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      {messy.map((e, i) => {
        const enter = interpolate(frame, [i * 12, i * 12 + 42], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const drift = interpolate(frame, [0, s(6)], [0, -30 - i * 14]);
        const pos = layout[i]!;
        return (
          <div
            key={e.id}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top + drift,
              zIndex: i,
              opacity: enter,
              transform: `translateY(${(1 - enter) * 50}px) rotate(${pos.rotate}deg)`,
            }}
          >
            <MailCard email={e} lines={13} />
          </div>
        );
      })}
      <Caption from={s(0.6)} to={s(5.6)}>Order emails arrive like this.</Caption>
    </AbsoluteFill>
  );
}

function ByHand() {
  const frame = useCurrentFrame();
  const typed = (text: string, start: number, cps = 30) => text.slice(0, Math.max(0, Math.floor(((frame - start) / FPS) * cps)));
  const caret = (text: string, start: number, cps?: number) =>
    frame >= start && typed(text, start, cps).length < text.length ? <span className="ml-px inline-block h-6 w-[2px] translate-y-1 bg-accent-bright" /> : null;
  const fields: Array<[string, string, number]> = [
    ["Customer", repeat.customer?.name ?? "", s(0.6)],
    ["Delivery date", repeat.deliveryDate ?? "", s(1.5)],
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", left: 120, top: 150 }}>
        <MailCard email={repeat} lines={14} width={600} />
      </div>
      <div className="absolute left-[790px] top-[150px] w-[1010px] rounded-[14px] border border-line bg-panel p-9">
        <div className="text-[15px] uppercase tracking-[0.1em] text-fg-3">New sales order</div>
        <div className="mt-7 grid grid-cols-2 gap-6">
          {fields.map(([label, value, start]) => (
            <div key={label}>
              <div className="text-[15px] text-fg-3">{label}</div>
              <div className="mt-2 h-12 rounded-[6px] border border-line-strong bg-canvas px-4 text-[19px] leading-[48px] text-fg">
                {typed(value, start)}
                {caret(value, start)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-[15px] text-fg-3">Lines</div>
        <div className="mt-2 divide-y divide-line rounded-[8px] border border-line">
          {repeat.lines.slice(0, 6).map((l, i) => {
            const start = s(2.3) + i * s(0.62);
            const text = `${String(l.qty ?? "").padStart(2)} ${(l.unit ?? "").padEnd(6)} ${(l.sku ?? "").padEnd(14)} ${l.name ?? ""}`;
            return (
              <div key={i} className="h-[52px] whitespace-pre px-5 font-mono text-[16.5px] leading-[52px] text-fg-2">
                {typed(text, start, 46)}
                {caret(text, start, 46)}
              </div>
            );
          })}
        </div>
      </div>
      <Caption from={s(0.4)} to={s(6.4)}>Someone retypes every one by hand.</Caption>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// The console walkthrough: one continuous take with a camera and a cursor.

interface Beat {
  at: number;
  selectedId?: string;
  filter?: Filter;
  view?: View;
  pane?: Pane;
}

function stateAt(frame: number, beats: Beat[]) {
  const st: Required<Omit<Beat, "at">> = { selectedId: byTime[0]!.id, filter: "all", view: "original", pane: "decision" };
  for (const b of beats) if (b.at <= frame) Object.assign(st, Object.fromEntries(Object.entries(b).filter(([k]) => k !== "at")));
  return st;
}

export const TAKE = s(31.5);

function ConsoleTake() {
  const frame = useCurrentFrame();
  const stage = useRef<HTMLDivElement>(null);

  const T = {
    clickRepeat: s(2.0),
    hover0: s(3.5),
    hover1: s(5.1),
    hover2: s(6.7),
    clickReviewFilter: s(9.6),
    clickClarify: s(11.0),
    toReply: s(14.2),
    clickInjection: s(17.4),
    toReviewer: s(20.4),
    clickMasked: s(24.0),
    toggleMasked: s(25.3),
    end: TAKE,
  };

  const beats: Beat[] = [
    { at: 0, selectedId: byTime[0]!.id },
    { at: T.clickRepeat, selectedId: repeat.id },
    { at: T.clickReviewFilter, filter: "needs_review" },
    { at: T.clickClarify, selectedId: clarify.id },
    { at: T.clickInjection, selectedId: injection.id },
    { at: T.clickMasked, selectedId: masked.id },
    { at: T.toggleMasked, view: "masked" },
  ];
  const st = stateAt(frame, beats);

  const hoverLine =
    frame >= T.hover2 && frame < T.clickReviewFilter - s(0.6) ? 2 : frame >= T.hover1 && frame < T.hover2 ? 1 : frame >= T.hover0 && frame < T.hover1 ? 0 : null;

  const points = useStagePoints(
    stage,
    {
      repeatRow: `[data-id="${repeat.id}"]`,
      clarifyRow: `[data-id="${clarify.id}"]`,
      injectionRow: `[data-id="${injection.id}"]`,
      maskedRow: `[data-id="${masked.id}"]`,
      reviewFilter: `[data-filter="needs_review"]`,
      maskedTab: `[data-view-tab="masked"]`,
      row0: `tr[data-line="0"]`,
      row1: `tr[data-line="1"]`,
      row2: `tr[data-line="2"]`,
      mark1: `mark[data-line="1"]`,
      flagged: `mark[data-flagged]`,
      body: `[data-email-body]`,
      review: `[data-section="review"]`,
      reply: `[data-section="reply"]`,
    },
    frame,
  );
  const p = (name: string): Point => points[name] ?? { x: STAGE.w / 2, y: STAGE.h / 2, w: 0, h: 0 };
  const at = (name: string, dx = 0, dy = 0) => ({ x: p(name).x + dx, y: p(name).y + dy });
  // Frame a point so it sits a little above centre, clear of the lower-third caption.
  const frameOn = (pt: { x: number; y: number }, zoom: number) => ({ x: pt.x, y: pt.y + 130 / zoom, zoom });
  const between = (a: string, b: string) => ({ x: (p(a).x + p(b).x) / 2, y: (p(a).y + p(b).y) / 2 });
  const rowLeft = (n: string) => ({ x: p(n).x - p(n).w / 2 + 140, y: p(n).y });

  const wide: Omit<Shot, "at"> = { x: STAGE.w / 2, y: STAGE.h / 2, zoom: 1.2 };
  const shots: Shot[] = [
    { at: 0, ...wide },
    { at: T.clickRepeat + s(0.4), ...wide },
    { at: T.hover0 - s(0.3), ...frameOn(between("mark1", "row1"), 1.42) },
    { at: T.clickReviewFilter - s(0.8), ...frameOn(between("mark1", "row1"), 1.42) },
    { at: T.clickReviewFilter, ...wide },
    { at: T.clickClarify + s(0.5), ...wide },
    { at: T.clickClarify + s(1.4), ...frameOn(at("review"), 1.75) },
    { at: T.toReply, ...frameOn(at("review"), 1.75) },
    { at: T.toReply + s(1.1), ...frameOn(at("reply", 0, -60), 1.65) },
    { at: T.clickInjection - s(0.9), ...frameOn(at("reply", 0, -60), 1.65) },
    { at: T.clickInjection, ...wide },
    { at: T.clickInjection + s(1.2), ...frameOn(at("flagged"), 1.7) },
    { at: T.toReviewer, ...frameOn(at("flagged"), 1.7) },
    { at: T.toReviewer + s(1.0), ...frameOn(at("review"), 1.8) },
    { at: T.clickMasked - s(0.8), ...frameOn(at("review"), 1.8) },
    { at: T.clickMasked, ...wide },
    { at: T.toggleMasked + s(0.9), ...frameOn(at("body", 0, -40), 1.55) },
    { at: T.end, ...frameOn(at("body", 0, -40), 1.6) },
  ];

  const cursor: CursorKey[] = [
    { at: 0, x: STAGE.w * 0.94, y: STAGE.h * 0.96 },
    { at: T.clickRepeat - s(0.9), ...at("repeatRow", -40, -8) },
    { at: T.clickRepeat, ...at("repeatRow", -40, -8), click: true },
    { at: T.hover0, ...rowLeft("row0") },
    { at: T.hover1, ...rowLeft("row1") },
    { at: T.hover2, ...rowLeft("row2") },
    { at: T.clickReviewFilter - s(0.8), ...at("reviewFilter") },
    { at: T.clickReviewFilter, ...at("reviewFilter"), click: true },
    { at: T.clickClarify - s(0.7), ...at("clarifyRow", -40, -8) },
    { at: T.clickClarify, ...at("clarifyRow", -40, -8), click: true },
    { at: T.clickInjection - s(0.7), ...at("injectionRow", -40, -8) },
    { at: T.clickInjection, ...at("injectionRow", -40, -8), click: true },
    { at: T.clickMasked - s(0.7), ...at("maskedRow", -40, -8) },
    { at: T.clickMasked, ...at("maskedRow", -40, -8), click: true },
    { at: T.toggleMasked - s(0.6), ...at("maskedTab") },
    { at: T.toggleMasked, ...at("maskedTab"), click: true },
    { at: T.end, ...at("maskedTab", 40, 60) },
  ];

  return (
    <AbsoluteFill>
      <Backdrop />
      <Camera shots={shots} stage={STAGE}>
        <div ref={stage} style={{ width: STAGE.w, height: STAGE.h, position: "relative" }}>
          <Console
            emails={byTime}
            mode={demo.mode}
            interactive={false}
            selectedId={st.selectedId}
            filter={st.filter}
            view={st.view}
            pane={st.pane}
            activeLine={hoverLine}
            className="h-[900px] w-[1600px] shadow-[0_30px_80px_rgba(0,0,0,0.16)]"
          />
          <Cursor keys={cursor} />
        </div>
      </Camera>
      <Caption from={s(0.8)} to={T.clickReviewFilter - s(0.3)}>
        It reads each order, and shows where every value came from.
      </Caption>
      <Caption from={T.clickClarify + s(0.8)} to={T.clickInjection - s(0.3)}>
        When it isn&apos;t sure, it tells a person why, and drafts the question.
      </Caption>
      <Caption from={T.clickInjection + s(0.8)} to={T.clickMasked - s(0.3)}>
        Instructions hidden in an email are flagged for a person, never followed.
      </Caption>
      <Caption from={T.toggleMasked + s(0.4)} to={T.end}>
        Contact details are hidden before any model sees the email.
      </Caption>
    </AbsoluteFill>
  );
}

function WeekNumbers() {
  const frame = useCurrentFrame();
  const w = demo.week;
  const items = [
    { value: w.emails, label: "order emails, Monday to Friday" },
    { value: w.routes.create_draft, label: "became draft orders" },
    { value: w.routes.needs_review, label: "went to a person, with the reason" },
    { value: w.reasons.find((r) => r.reason === "suspicious_instructions")?.count ?? 0, label: "attempts to instruct the system, stopped" },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <div className="absolute left-[140px] right-[140px] top-[230px] grid grid-cols-4 gap-12">
        {items.map((it, i) => {
          const a = interpolate(frame, [i * 8, i * 8 + 34], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const count = Math.round(interpolate(frame, [i * 8, i * 8 + 50], [0, it.value], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
          return (
            <div key={it.label} style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)` }} className="border-t border-line-strong pt-6">
              <div className={`tabular text-[150px] font-medium leading-none tracking-[-0.04em] ${i === 3 ? "text-rose" : "text-fg"}`}>{count}</div>
              <div className="mt-5 text-[26px] leading-snug text-fg-2">{it.label}</div>
            </div>
          );
        })}
      </div>
      <Caption from={s(0.8)} to={s(8.6)}>
        One week of orders, and the reason behind every decision.
      </Caption>
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 36], [0, 1], { easing: ease, extrapolateRight: "clamp" });
  const b = interpolate(frame, [26, 62], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop />
      <div className="absolute left-[150px] top-[290px] max-w-[1500px]">
        <div className="display text-[104px] leading-[1.04] text-fg" style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
          I build systems like this
          <br />
          for real operations.
        </div>
        <div className="mt-16 flex items-center gap-6 text-[30px] text-fg-2" style={{ opacity: b }}>
          <span className="font-medium text-fg">Sandro T.</span>
          <span className="text-fg-4">·</span>
          <span>AI and full-stack engineer</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function OrderlyVideo() {
  return (
    <AbsoluteFill className="bg-canvas font-sans">
      <FontRoot />
      <Sequence durationInFrames={s(6)}>
        <MessyInbox />
      </Sequence>
      <Sequence from={s(6)} durationInFrames={s(6.8)}>
        <ByHand />
      </Sequence>
      <Sequence from={s(12.8)} durationInFrames={TAKE}>
        <ConsoleTake />
      </Sequence>
      <Sequence from={s(12.8) + TAKE} durationInFrames={s(9)}>
        <WeekNumbers />
      </Sequence>
      <Sequence from={s(21.8) + TAKE} durationInFrames={DURATION - s(21.8) - TAKE}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
