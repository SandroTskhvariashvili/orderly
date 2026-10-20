const STEPS: Array<{ name: string; who: "code" | "model" | "person"; detail: string }> = [
  { name: "Read", who: "code", detail: "Email and PDF attachments" },
  { name: "Mask", who: "code", detail: "Phones, emails, IBANs, addresses out" },
  { name: "Sort", who: "model", detail: "Order, change, question, complaint…" },
  { name: "Read the order", who: "model", detail: "Catalog and history lookups, every value quoted" },
  { name: "Check", who: "code", detail: "Stock, credit, delivery days, history, duplicates" },
  { name: "Route", who: "code", detail: "Draft order, or review with the reason" },
  { name: "Approve", who: "person", detail: "Nothing ships without it" },
];

// The model is deliberately not painted in the "go" colour: it proposes, code decides.
const WHO = {
  code: { label: "Code", chip: "border-line-strong text-fg-3", cell: "bg-canvas" },
  model: { label: "Model", chip: "border-fg-3 text-fg", cell: "bg-raised" },
  person: { label: "Person", chip: "border-amber/60 text-amber", cell: "bg-canvas" },
} as const;

export function Pipeline() {
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line lg:grid-cols-7">
      {STEPS.map((s, i) => {
        const w = WHO[s.who];
        return (
          <li key={s.name} className={`${w.cell} p-4 last:col-span-2 lg:last:col-span-1`}>
            <div className="flex items-center justify-between">
              <span className="tabular text-[11px] text-fg-3">{String(i + 1).padStart(2, "0")}</span>
              <span className={`rounded-[4px] border px-1.5 py-px text-[12px] ${w.chip}`}>{w.label}</span>
            </div>
            <p className="mt-4 text-[14px] font-medium text-fg">{s.name}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-fg-3">{s.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}
