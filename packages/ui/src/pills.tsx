import { REASON_LABEL, ROUTE_LABEL } from "./format.ts";
import type { RouteName } from "./types.ts";

const ROUTE_STYLE: Record<RouteName, { text: string; dot: string; bg: string }> = {
  create_draft: { text: "text-accent-bright", dot: "bg-accent-bright", bg: "bg-accent-soft" },
  needs_review: { text: "text-amber", dot: "bg-amber", bg: "bg-amber-soft" },
  not_an_order: { text: "text-fg-3", dot: "bg-fg-4", bg: "bg-raised" },
};

export function RoutePill({ route, size = "sm" }: { route: RouteName; size?: "sm" | "md" }) {
  const s = ROUTE_STYLE[route];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[4px] ${s.bg} ${s.text} ${
        size === "md" ? "px-2 py-0.5 text-[13px]" : "px-1.5 py-px text-[12px]"
      } font-medium`}
    >
      <span className={`size-1.5 rounded-[1px] ${s.dot}`} aria-hidden />
      {ROUTE_LABEL[route]}
    </span>
  );
}

export function ReasonTag({ reason, extra = 0 }: { reason: string; extra?: number }) {
  const danger = reason === "suspicious_instructions";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11.5px] font-medium ${
        danger ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber"
      }`}
    >
      {REASON_LABEL[reason] ?? reason}
      {extra > 0 && <span className="tabular opacity-80">+{extra}</span>}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded-[4px] border border-line-strong bg-raised px-1 font-mono text-[11px] leading-[16px] text-fg-2">
      {children}
    </kbd>
  );
}
