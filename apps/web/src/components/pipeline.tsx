const STEPS: Array<{ name: string; who: "code" | "model" | "person"; detail: string }> = [
  { name: "Read", who: "code", detail: "Email and PDF attachments" },
  { name: "Mask", who: "code", detail: "Phones, emails, IBANs, addresses out" },
  { name: "Sort", who: "model", detail: "Order, change, question, complaint…" },
  { name: "Read the order", who: "model", detail: "Catalog and history lookups, every value quoted" },
  { name: "Check", who: "code", detail: "Stock, credit, delivery days, history, duplicates" },
  { name: "Route", who: "code", detail: "Draft order, or review with the reason" },
  { name: "Approve", who: "person", detail: "Nothing ships without it" },
];

const WHO = {
  code: { label: "code", ring: "border-line-strong", dot: "bg-fg-3" },
  model: { label: "model", ring: "border-accent/60", dot: "bg-accent-bright" },
  person: { label: "person", ring: "border-amber/60", dot: "bg-amber" },
} as const;

export function Pipeline() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-7">
      {STEPS.map((s, i) => {
        const w = WHO[s.who];
        return (
          <li key={s.name} className="bg-canvas p-4">
            <div className="flex items-center justify-between">
              <span className="tabular text-[11px] text-fg-4">{String(i + 1).padStart(2, "0")}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border ${w.ring} px-2 py-px text-[10.5px] uppercase tracking-[0.06em] text-fg-2`}>
                <span className={`size-1.5 rounded-full ${w.dot}`} aria-hidden />
                {w.label}
              </span>
            </div>
            <p className="mt-4 text-[14px] font-medium text-fg">{s.name}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-fg-3">{s.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
