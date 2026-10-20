import { REASON_LABEL, ROUTE_LABEL } from "./format.ts";
import type { RouteName } from "./types.ts";

const ROUTE_STYLE: Record<RouteName, { text: string; dot: string; bg: string }> = {
  create_draft: { text: "text-accent-bright", dot: "bg-accent-bright", bg: "bg-accent-soft" },
  needs_review: { text: "text-amber", dot: "bg-amber", bg: "bg-amber-soft" },
  not_an_order: { text: "text-fg-3", dot: "bg-fg-4", bg: "bg-hover/60" },
};

export function RoutePill({ route, size = "sm" }: { route: RouteName; size?: "sm" | "md" }) {
  const s = ROUTE_STYLE[route];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full ${s.bg} ${s.text} ${
        size === "md" ? "px-2.5 py-1 text-[11.5px]" : "px-2 py-0.5 text-[10.5px]"
      } font-medium uppercase tracking-[0.06em]`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {ROUTE_LABEL[route]}
    </span>
  );
}

export function ReasonTag({ reason }: { reason: string }) {
  const danger = reason === "suspicious_instructions";
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-1.5 py-px text-[11px] font-medium ${
        danger ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber"
      }`}
    >
      {REASON_LABEL[reason] ?? reason}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded-[4px] border border-line-strong bg-raised px-1 font-[ui-monospace,'SF_Mono',Menlo,monospace] text-[10.5px] leading-[16px] text-fg-2">
      {children}
    </kbd>
  );
}
