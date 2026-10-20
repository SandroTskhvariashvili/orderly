"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuditTrail } from "./audit-trail.tsx";
import { DecisionPanel } from "./decision-panel.tsx";
import { EmailView, type View } from "./email-view.tsx";
import { dayTime } from "./format.ts";
import { Kbd, RoutePill } from "./pills.tsx";
import type { DemoEmail, RouteName } from "./types.ts";

export type Filter = "all" | RouteName;
export type Pane = "decision" | "trail";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "create_draft", label: "Created" },
  { id: "needs_review", label: "Review" },
  { id: "not_an_order", label: "Other" },
];

export interface ConsoleProps {
  emails: DemoEmail[];
  initialId?: string;
  /** Controlled overrides, used by the video to script the walkthrough. */
  selectedId?: string;
  activeLine?: number | null;
  view?: View;
  pane?: Pane;
  filter?: Filter;
  /** Fixed height for the video; the web app sizes it with CSS. */
  className?: string;
  interactive?: boolean;
}

export function Console(props: ConsoleProps) {
  const { emails, interactive = true } = props;
  const [filterState, setFilter] = useState<Filter>("all");
  const [selectedState, setSelected] = useState<string>(props.initialId ?? emails[0]?.id ?? "");
  const [lineState, setLine] = useState<number | null>(null);
  const [viewState, setView] = useState<View>("original");
  const [paneState, setPane] = useState<Pane>("decision");

  const filter = props.filter ?? filterState;
  const selectedId = props.selectedId ?? selectedState;
  const activeLine = props.activeLine !== undefined ? props.activeLine : lineState;
  const view = props.view ?? viewState;
  const pane = props.pane ?? paneState;

  const visible = useMemo(() => (filter === "all" ? emails : emails.filter((e) => e.route === filter)), [emails, filter]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: emails.length, create_draft: 0, needs_review: 0, not_an_order: 0 };
    for (const e of emails) c[e.route]++;
    return c;
  }, [emails]);
  const email = emails.find((e) => e.id === selectedId) ?? visible[0] ?? emails[0];

  const listRef = useRef<HTMLUListElement>(null);
  const select = useCallback((id: string) => {
    setSelected(id);
    setLine(null);
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const i = visible.findIndex((e) => e.id === email?.id);
      if (ev.key === "j" || ev.key === "ArrowDown") {
        const next = visible[Math.min(visible.length - 1, i + 1)];
        if (next && target.closest("[data-console]")) {
          ev.preventDefault();
          select(next.id);
        }
      } else if (ev.key === "k" || ev.key === "ArrowUp") {
        const prev = visible[Math.max(0, i - 1)];
        if (prev && target.closest("[data-console]")) {
          ev.preventDefault();
          select(prev.id);
        }
      } else if (ev.key === "m" && target.closest("[data-console]")) {
        setView((v) => (v === "original" ? "masked" : "original"));
      } else if (ev.key === "t" && target.closest("[data-console]")) {
        setPane((p) => (p === "decision" ? "trail" : "decision"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, visible, email?.id, select]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-id="${email?.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [email?.id]);

  if (!email) return null;

  return (
    <div
      data-console
      tabIndex={-1}
      className={`grid overflow-hidden rounded-[14px] border border-line bg-canvas outline-none lg:grid-cols-[300px_minmax(0,1fr)_380px] ${props.className ?? ""}`}
    >
      {/* Inbox */}
      <aside className="flex min-h-0 flex-col border-b border-line bg-panel lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-[13px] font-semibold text-fg">orders@ inbox</h2>
          <span className="tabular text-[11.5px] text-fg-3">Oct 12 to 16</span>
        </div>
        <div role="tablist" aria-label="Filter by outcome" className="flex gap-1 px-3 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-[6px] px-2 py-1 text-[12px] transition-colors duration-150 ${
                filter === f.id ? "bg-hover text-fg" : "text-fg-3 hover:text-fg-2"
              }`}
            >
              {f.label}
              <span className="tabular ml-1.5 text-[11px] text-fg-4">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Emails"
          className="max-h-[260px] min-h-0 flex-1 overflow-y-auto border-t border-line lg:max-h-none"
        >
          {visible.map((e) => {
            const on = e.id === email.id;
            return (
              <li
                key={e.id}
                data-id={e.id}
                role="option"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => select(e.id)}
                onKeyDown={(ev) => ev.key === "Enter" && select(e.id)}
                className={`relative cursor-pointer border-b border-line px-4 py-3 transition-colors duration-150 ${
                  on ? "bg-hover" : "hover:bg-raised"
                }`}
              >
                {on && <span className="absolute inset-y-3 left-0 w-[2px] rounded-r bg-accent-bright" aria-hidden />}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-fg">{e.from.name || e.from.address}</span>
                  <span className="tabular shrink-0 text-[11px] text-fg-3">{dayTime(e.receivedAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-fg-2">{e.subject || "(no subject)"}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <RoutePill route={e.route} />
                  {!e.check.correct && <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-rose">miss</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-fg-3 lg:flex">
          <span className="flex items-center gap-1">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>m</Kbd> model view
          </span>
          <span className="flex items-center gap-1">
            <Kbd>t</Kbd> trail
          </span>
        </div>
      </aside>

      {/* Email */}
      <div className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
        <EmailView email={email} view={view} onViewChange={setView} activeLine={activeLine} onHoverLine={interactive ? setLine : undefined} />
      </div>

      {/* Decision */}
      <div className="flex min-h-0 flex-col bg-panel/40">
        <div role="tablist" aria-label="Details" className="flex gap-4 border-b border-line px-5 pt-3 text-[12.5px]">
          {(
            [
              ["decision", "Decision"],
              ["trail", "Audit trail"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={`-mb-px border-b-2 pb-2.5 transition-colors duration-150 ${
                pane === id ? "border-accent-bright text-fg" : "border-transparent text-fg-3 hover:text-fg-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {pane === "decision" ? (
            <DecisionPanel email={email} activeLine={activeLine} onHoverLine={interactive ? setLine : undefined} />
          ) : (
            <AuditTrail email={email} />
          )}
        </div>
      </div>
    </div>
  );
}
