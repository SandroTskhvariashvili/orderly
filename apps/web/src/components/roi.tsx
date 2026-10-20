"use client";

import { useId, useState } from "react";

const WORKDAYS = 21;

function Field({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-[6px] border border-fg-4 bg-panel px-3 focus-within:border-accent-bright">
        {prefix && <span className="tabular text-fg-3">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => {
            const n = Math.min(max, Math.max(min, Number(draft) || min));
            setDraft(String(n));
            onChange(n);
          }}
          className="tabular w-full bg-transparent py-2 text-[15px] text-fg outline-none"
        />
        {suffix && <span className="text-[13px] text-fg-3">{suffix}</span>}
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-fg-3">
        {hint}
      </p>
    </div>
  );
}

export function RoiCalculator({ measuredPct, costPerEmailUsd }: { measuredPct: number | null; costPerEmailUsd: number | null }) {
  const [perDay, setPerDay] = useState(40);
  const [minutes, setMinutes] = useState(4);
  const [hourly, setHourly] = useState(30);
  const [assumedPct, setAssumedPct] = useState(50);
  const [approveSec, setApproveSec] = useState(30);

  const draftedPct = measuredPct ?? assumedPct;
  const monthly = perDay * WORKDAYS;
  const drafted = Math.round((monthly * draftedPct) / 100);
  const hoursSaved = Math.max(0, (drafted * (minutes - approveSec / 60)) / 60);
  const moneySaved = hoursSaved * hourly;
  const runCost = costPerEmailUsd == null ? null : monthly * costPerEmailUsd;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Order emails per day" hint="Everything that reaches the orders inbox." value={perDay} onChange={setPerDay} min={1} max={2000} />
        <Field label="Minutes to enter one by hand" hint="Reading, looking up, typing, checking." value={minutes} onChange={setMinutes} min={0.5} max={60} step={0.5} />
        <Field label="Hourly cost of that person" hint="Salary plus overhead." value={hourly} onChange={setHourly} min={5} max={200} prefix="€" />
        <Field label="Seconds to approve a draft" hint="A person still approves every draft order." value={approveSec} onChange={setApproveSec} min={0} max={600} suffix="sec" />
        {measuredPct == null && (
          <div className="sm:col-span-2">
            <Field
              label="Share you expect to become drafts"
              hint="Your assumption. A pilot on your own emails measures the real number."
              value={assumedPct}
              onChange={setAssumedPct}
              min={0}
              max={100}
              suffix="%"
            />
          </div>
        )}
      </div>
      <div className="border-t border-line-strong pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        <p className="text-[13px] text-fg-3">Every month, roughly</p>
        <p className="tabular mt-2 text-[48px] font-medium leading-none tracking-[-0.03em] text-fg" aria-live="polite" aria-atomic="true">
          {Math.round(hoursSaved)}
          <span className="ml-2 font-sans text-[20px] font-normal tracking-normal text-fg-2">hours back</span>
        </p>
        <dl className="mt-8 space-y-3 text-[14px]">
          <div className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="text-fg-2">Emails a month</dt>
            <dd className="tabular text-fg">{monthly.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="text-fg-2">
              Drafted, only approval needed ({draftedPct}%, {measuredPct == null ? "your assumption" : "measured"})
            </dt>
            <dd className="tabular text-fg">{drafted.toLocaleString("en-US")}</dd>
          </div>
          <div className={`flex justify-between gap-6 ${runCost == null ? "" : "border-b border-line pb-3"}`}>
            <dt className="text-fg-2">Staff time that frees up</dt>
            <dd className="tabular text-fg">€{Math.round(moneySaved).toLocaleString("en-US")}</dd>
          </div>
          {runCost != null && (
            <div className="flex justify-between gap-6">
              <dt className="text-fg-2">Model cost for all {monthly.toLocaleString("en-US")} emails</dt>
              <dd className="tabular text-fg">${Math.round(runCost).toLocaleString("en-US")}</dd>
            </div>
          )}
        </dl>
        <p className="mt-6 max-w-[62ch] text-[12.5px] leading-relaxed text-fg-3">
          Only drafted emails count, minus the time to approve them. Emails that go to review still take someone’s time, just less of it.
        </p>
      </div>
    </div>
  );
}
