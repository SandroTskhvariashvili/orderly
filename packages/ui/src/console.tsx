"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AuditTrail } from "./audit-trail.tsx";
import { DecisionPanel } from "./decision-panel.tsx";
import { EmailView, type View } from "./email-view.tsx";
import { dayTime } from "./format.ts";
import { Kbd, ReasonTag, RoutePill } from "./pills.tsx";
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
  mode?: "sample" | "live";
  initialId?: string;
  /** Controlled overrides, used by the video to script the walkthrough. */
  selectedId?: string;
  activeLine?: number | null;
  view?: View;
  pane?: Pane;
  filter?: Filter;
  className?: string;
  interactive?: boolean;
}

function RowStatus({ e }: { e: DemoEmail }) {
  if (e.route !== "needs_review" || !e.issues.length) return <RoutePill route={e.route} />;
  const reasons = [...new Set(e.issues.map((i) => i.reason))];
  return <ReasonTag reason={reasons[0]!} extra={reasons.length - 1} />;
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

  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const select = useCallback((id: string) => {
    setSelected(id);
    setLine(null);
  }, []);

  const applyFilter = (f: Filter) => {
    setFilter(f);
    const next = f === "all" ? emails : emails.filter((e) => e.route === f);
    if (!next.some((e) => e.id === selectedId) && next[0]) select(next[0].id);
  };

  // Deep links like #E-013 open that email.
  useEffect(() => {
    if (!interactive) return;
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!emails.some((e) => e.id === id)) return;
      setFilter("all");
      select(id);
      root.current?.scrollIntoView({ block: "start" });
    };
    // Same-hash clicks fire no hashchange, so links are handled directly too.
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element).closest?.<HTMLAnchorElement>('a[href^="#E-"]');
      const id = a?.hash.slice(1);
      if (!a || !id || !emails.some((e) => e.id === id)) return;
      ev.preventDefault();
      history.replaceState(null, "", a.hash);
      setFilter("all");
      select(id);
      root.current?.scrollIntoView({ block: "start" });
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.focus({ preventScroll: true }));
    };
    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", open);
      document.removeEventListener("click", onClick);
    };
  }, [interactive, emails, select]);

  // Keyboard: j/k anywhere in the console, arrows only inside the list.
  useEffect(() => {
    if (!interactive) return;
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement;
      if (!target.closest("[data-console]") || target.closest("input, textarea, select") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const inList = Boolean(target.closest('[role="listbox"]'));
      const i = visible.findIndex((e) => e.id === email?.id);
      const down = ev.key === "j" || (inList && ev.key === "ArrowDown");
      const up = ev.key === "k" || (inList && ev.key === "ArrowUp");
      if (down || up) {
        const next = visible[down ? Math.min(visible.length - 1, i + 1) : Math.max(0, i - 1)];
        if (next) {
          ev.preventDefault();
          select(next.id);
        }
      } else if (ev.key === "m") {
        setView((v) => (v === "original" ? "masked" : "original"));
      } else if (ev.key === "t") {
        setPane((p) => (p === "decision" ? "trail" : "decision"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, visible, email?.id, select]);

  // Keep the selected row visible inside the list. Never scrolls the page.
  // On first show the row goes to the top; while moving, it stays at the nearest edge.
  const placed = useRef(false);
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-id="${email?.id}"]`);
    if (!list || !row) return;
    if (!placed.current) {
      placed.current = true;
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
    if (interactive && list.contains(document.activeElement)) row.focus({ preventScroll: true });
  }, [email?.id, interactive]);

  if (!email) return null;
  const selectedVisible = visible.some((e) => e.id === email.id);

  return (
    <div
      ref={root}
      data-console
      className={`grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[14px] border border-line bg-canvas md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_380px] ${props.className ?? ""}`}
    >
      {/* Inbox */}
      <aside className="flex min-h-0 flex-col border-b border-line bg-panel md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h3 className="text-[13px] font-semibold text-fg">orders@ inbox</h3>
          <span className="tabular text-[11.5px] text-fg-3">Oct 12 to 16</span>
        </div>
        <div role="group" aria-label="Filter by outcome" className="flex gap-1 px-3 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-filter={f.id}
              aria-pressed={filter === f.id}
              onClick={() => applyFilter(f.id)}
              className={`rounded-[6px] px-2 py-1 text-[12px] transition-colors duration-150 ${
                filter === f.id ? "bg-hover text-fg shadow-[inset_0_-2px_0_var(--color-accent-bright)]" : "text-fg-3 hover:text-fg-2"
              }`}
            >
              {f.label}
              <span className={`tabular ml-1.5 text-[11px] ${filter === f.id ? "text-fg-2" : "text-fg-3"}`}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Emails"
          aria-keyshortcuts="j k ArrowDown ArrowUp"
          className="relative max-h-[264px] min-h-0 flex-1 overflow-y-auto border-t border-line md:max-h-[560px] lg:max-h-none"
        >
          {visible.map((e, idx) => {
            const on = e.id === email.id;
            const focusable = on || (!selectedVisible && idx === 0);
            return (
              <li
                key={e.id}
                data-id={e.id}
                role="option"
                aria-selected={on}
                tabIndex={focusable ? 0 : -1}
                onClick={() => select(e.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), select(e.id))}
                className={`relative cursor-pointer border-b border-line px-4 py-3 outline-offset-[-2px] transition-colors duration-150 ${
                  on ? "bg-hover" : "hover:bg-raised"
                }`}
              >
                {on && <span className="absolute inset-y-3 left-0 w-[2px] rounded-r bg-accent-bright" aria-hidden />}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-fg">{e.from.name || e.from.address}</span>
                  <span className="tabular shrink-0 text-[11px] text-fg-2">{dayTime(e.receivedAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-[12.5px] text-fg-2">{e.subject || "(no subject)"}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <RowStatus e={e} />
                  {props.mode === "live" && !e.check.correct && (
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-rose">miss</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden items-center gap-3 border-t border-line px-4 py-2.5 text-[11.5px] text-fg-3 lg:flex">
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
        <EmailView email={email} view={view} onViewChange={setView} activeLine={activeLine} />
      </div>

      {/* Decision */}
      <div className="flex min-h-0 flex-col bg-panel/40 md:col-span-2 lg:col-span-1">
        <div role="tablist" aria-label="Details" className="flex gap-4 border-b border-line px-5 pt-3 text-[12.5px]">
          {(
            [
              ["decision", "Decision"],
              ["trail", "Audit trail"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              data-pane-tab={id}
              aria-selected={pane === id}
              aria-controls="console-details"
              tabIndex={pane === id ? 0 : -1}
              onClick={() => setPane(id)}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
                  const next = pane === "decision" ? "trail" : "decision";
                  setPane(next);
                  (ev.currentTarget.parentElement?.querySelector(`[data-pane-tab="${next}"]`) as HTMLElement | null)?.focus();
                }
              }}
              className={`-mb-px border-b-2 pb-2.5 transition-colors duration-150 ${
                pane === id ? "border-accent-bright text-fg" : "border-transparent text-fg-3 hover:text-fg-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          id="console-details"
          role="tabpanel"
          aria-labelledby={`tab-${pane}`}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto outline-offset-[-2px] lg:[mask-image:linear-gradient(to_bottom,#000_94%,transparent)]"
        >
          {pane === "decision" ? (
            <DecisionPanel email={email} mode={props.mode ?? "sample"} activeLine={activeLine} onHoverLine={interactive ? setLine : undefined} />
          ) : (
            <AuditTrail email={email} />
          )}
        </div>
      </div>
    </div>
  );
}
