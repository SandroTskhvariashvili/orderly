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
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-[6px] border border-line-strong bg-panel px-3 focus-within:border-accent">
        {prefix && <span className="tabular text-fg-3">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="tabular w-full bg-transparent py-2 text-[15px] text-fg outline-none"
        />
      </div>
      <p className="mt-1.5 text-[12px] text-fg-3">{hint}</p>
    </div>
  );
}

export function RoiCalculator({ automatedPct, costPerEmailUsd }: { automatedPct: number; costPerEmailUsd: number }) {
  const [perDay, setPerDay] = useState(40);
  const [minutes, setMinutes] = useState(4);
  const [hourly, setHourly] = useState(30);

  const monthly = perDay * WORKDAYS;
  const automated = Math.round((monthly * automatedPct) / 100);
  const hoursSaved = (automated * minutes) / 60;
  const moneySaved = hoursSaved * hourly;
  const runCost = monthly * costPerEmailUsd;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
        <Field label="Order emails per day" hint="Everything that reaches the orders inbox." value={perDay} onChange={setPerDay} min={1} max={2000} />
        <Field label="Minutes to enter one by hand" hint="Reading, looking up, typing, checking." value={minutes} onChange={setMinutes} min={0.5} max={60} step={0.5} />
        <Field label="Hourly cost of that person" hint="Salary plus overhead, in euros." value={hourly} onChange={setHourly} min={5} max={200} prefix="€" />
      </div>
      <div className="border-t border-line-strong pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0" aria-live="polite">
        <p className="text-[13px] text-fg-3">Every month, roughly</p>
        <p className="tabular mt-2 text-[56px] font-medium leading-none tracking-[-0.03em] text-fg">
          {Math.round(hoursSaved)}
          <span className="ml-2 font-sans text-[20px] font-normal tracking-normal text-fg-2">hours back</span>
        </p>
        <dl className="mt-8 space-y-3 text-[14px]">
          <div className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="text-fg-2">Emails a month</dt>
            <dd className="tabular text-fg">{monthly.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="text-fg-2">Handled without a person ({automatedPct}%, measured)</dt>
            <dd className="tabular text-fg">{automated.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex justify-between gap-6 border-b border-line pb-3">
            <dt className="text-fg-2">Staff time that frees up</dt>
            <dd className="tabular text-fg">€{Math.round(moneySaved).toLocaleString("en-US")}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-fg-2">Model cost for all {monthly.toLocaleString("en-US")} emails</dt>
            <dd className="tabular text-fg">${Math.round(runCost).toLocaleString("en-US")}</dd>
          </div>
        </dl>
        <p className="mt-6 text-[12.5px] leading-relaxed text-fg-3">
          Only emails that need no person count as saved. Reviewed emails still take someone&apos;s time, just less of it. Your
          inbox will differ from this demo, which is why every project starts with a pilot on your own emails.
        </p>
      </div>
    </div>
  );
}
