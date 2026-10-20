import { ArrowUpRight } from "lucide-react";
import { ComparisonTable, Console, FailuresTable, HeadlineNumbers, MetricsTable, WeekBreakdown, type DemoData, type DemoEmail } from "@orderly/ui";
import { Pipeline } from "@/components/pipeline";
import { RoiCalculator } from "@/components/roi";
import { SOURCE_URL, UPWORK_URL } from "@/site";
import demoJson from "@/data/demo.json";

const demo = demoJson as unknown as DemoData;

function SectionTitle({ id, kicker, title, children }: { id?: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header id={id}>
      <p className="text-[13px] font-medium text-fg-3">{kicker}</p>
      <h2 className="display mt-2 max-w-[24ch] text-balance text-[32px] leading-[1.15] text-fg sm:text-[38px]">{title}</h2>
      {children && <div className="mt-4 max-w-[62ch] text-pretty text-[16px] leading-relaxed text-fg-2">{children}</div>}
    </header>
  );
}

/** The richest clean order: most lines that point to their source, with at least one unit conversion. */
function showcase(emails: DemoEmail[]): DemoEmail | undefined {
  const score = (e: DemoEmail) => e.lines.filter((l) => l.evidence).length + 3 * e.lines.filter((l) => l.conversion).length;
  return emails.filter((e) => e.route === "create_draft" && e.lines.some((l) => l.conversion)).sort((a, b) => score(b) - score(a))[0];
}

function HireButton({ children, className }: { children: React.ReactNode; className: string }) {
  if (!UPWORK_URL) return null;
  return (
    <a href={UPWORK_URL} className={className}>
      {children}
    </a>
  );
}

export default function Page() {
  const m = demo.metrics;
  const live = demo.mode === "live" && m !== null;
  const injection = demo.emails.find((e) => e.issues.some((i) => i.reason === "suspicious_instructions"));
  const injectionQuote = injection?.issues.find((i) => i.reason === "suspicious_instructions")?.message.match(/[“"](.+?)[”"]/)?.[1];
  const first = showcase(demo.emails) ?? demo.emails.find((e) => e.route === "create_draft");

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">
            <span className="grid size-5 place-items-center rounded-[5px] bg-accent text-[11px] font-bold text-canvas" aria-hidden>
              O
            </span>
            Orderly
          </a>
          <div className="flex items-center gap-1 text-[13px] sm:gap-5">
            <a href="#console" className="hidden px-2 py-1 text-fg-2 hover:text-fg sm:inline">
              Console
            </a>
            <a href="#how" className="hidden px-2 py-1 text-fg-2 hover:text-fg sm:inline">
              How it decides
            </a>
            <a href="#results" className="hidden px-2 py-1 text-fg-2 hover:text-fg sm:inline">
              {live ? "Results" : "This week"}
            </a>
            {SOURCE_URL && (
              <a href={SOURCE_URL} className="px-2 py-1 text-fg-2 hover:text-fg">
                Source
              </a>
            )}
            <HireButton className="rounded-[6px] bg-accent px-3 py-1.5 font-medium text-canvas transition-colors duration-150 hover:bg-accent-bright">
              Work with me
            </HireButton>
          </div>
        </div>
      </nav>

      <main id="top">
        {/* Hero, then straight into the product */}
        <section className="mx-auto max-w-[1320px] px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
          <p className="text-[13px] text-fg-3">A working demo by Sandro T., AI and full-stack engineer</p>
          <h1 className="display mt-4 max-w-[17ch] text-balance text-[36px] leading-[1.08] text-fg sm:text-[56px] lg:text-[68px]">
            Order emails, turned into checked draft orders.
          </h1>
          <p className="mt-7 max-w-[34em] text-pretty text-[17px] leading-relaxed text-fg-2">
            Orderly reads a wholesaler’s order inbox, checks every line against the catalog and the customer’s history, and creates draft
            orders. When something is unclear, unusual or suspicious, it stops and tells a person why.
          </p>
        </section>

        <section id="console" className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-6" aria-label="Interactive console">
          <h2 className="sr-only">One week of order emails, already processed</h2>
          <p className="mb-4 max-w-[68ch] text-[14px] leading-relaxed text-fg-3">
            One week, 60 emails. Pick one and hover or tap a line of the order: the words it came from light up in the email. Switch to{" "}
            <span className="text-fg-2">What the model saw</span> to see what was hidden before any model call.
          </p>
          <Console emails={demo.emails} mode={demo.mode} initialId={first?.id} className="lg:h-[760px]" />
          <div className="mt-10">
            <HeadlineNumbers data={demo} />
          </div>
          <p className="mt-6 max-w-[80ch] text-[12.5px] leading-relaxed text-fg-3">
            {live
              ? `Measured on ${m.emails} emails that were held back while it was built. `
              : "This demo replays recorded model output, so it runs without an API key. Catalog lookups, the twelve checks, routing and masking are the real code. "}
            All businesses and people in it are fictional.
          </p>
        </section>

        {/* How it decides */}
        <section className="border-t border-line bg-panel/40">
          <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
            <SectionTitle
              id="how"
              kicker="How it decides"
              title="A model reads the email. Plain code decides what happens."
            >
              It is a workflow with a model at two steps, not a free-roaming agent. That is why it can be trusted with orders.
            </SectionTitle>
            <div className="mt-12">
              <Pipeline />
            </div>
            <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
              <div className="max-w-[62ch]">
                <h3 className="text-[16px] font-semibold text-fg">It cannot write</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  The model can search the catalog and look up this customer’s orders. It cannot create an order, send an email or see
                  another customer. Twelve plain checks decide where each email goes, so every decision can be replayed and tested.
                </p>
              </div>
              <div className="max-w-[62ch]">
                <h3 className="text-[16px] font-semibold text-fg">Every value points to its source</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  Each order line carries the exact words it came from. If those words are not in the email, the line goes to review. The
                  model cannot invent a quantity and cite it.
                </p>
              </div>
              <div className="max-w-[62ch]">
                <h3 className="text-[16px] font-semibold text-fg">Contact details never reach the model</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  Phone numbers, email addresses, IBANs and street addresses are replaced with placeholders first. Names stay, so a reply can
                  greet someone.
                </p>
              </div>
              <div className="max-w-[62ch]">
                <h3 className="text-[16px] font-semibold text-fg">Instructions inside an email are just text</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  {injectionQuote ? (
                    <>
                      One email this week says <span className="text-rose">“{injectionQuote}”</span>. It was quoted for the reviewer and not
                      followed. <a href={`#${injection!.id}`} className="text-fg underline decoration-fg-3 underline-offset-4 hover:decoration-fg">Open it</a>.
                    </>
                  ) : (
                    "Text that tries to approve an order, change a price or skip review is quoted for the reviewer and never followed."
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
          {live ? (
            <>
              <SectionTitle id="results" kicker="Results" title="Measured, including what it gets wrong">
                Each email has an answer key written by hand before any tuning. 20 emails were used while building it. The {m.emails} below were
                run once, at the end, on {demo.comparison[0]?.label ?? m.model}.
              </SectionTitle>
              <div className="mt-12 grid gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <MetricsTable data={demo} />
                <div>
                  <h3 className="text-[16px] font-semibold text-fg">What it got wrong</h3>
                  <p className="mb-4 mt-1 text-[14px] text-fg-3">Every miss on the held-out set, unedited.</p>
                  <FailuresTable data={demo} />
                </div>
              </div>
              {demo.comparison.length > 1 && (
                <div className="mt-16 max-w-[900px]">
                  <h3 className="text-[16px] font-semibold text-fg">Same test, three models</h3>
                  <p className="mb-4 mt-1 text-[14px] text-fg-3">The model is a measured choice, not a habit.</p>
                  <ComparisonTable data={demo} />
                </div>
              )}
            </>
          ) : (
            <>
              <SectionTitle id="results" kicker="This week" title="What went to a person, and why">
                {demo.week.routes.create_draft} emails became draft orders, {demo.week.routes.not_an_order} were not orders, and{" "}
                {demo.week.routes.needs_review} went to a person with a plain reason. One email can carry more than one reason.
              </SectionTitle>
              <div className="mt-12 grid gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <WeekBreakdown data={demo} />
                <div>
                  <h3 className="text-[16px] font-semibold text-fg">Measuring it on your inbox</h3>
                  <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-fg-2">
                    Every email here has an answer key written by hand: what a careful person would do with it. The same harness that checks these
                    samples runs live against the model and scores it on emails it never saw while it was built. The headline number is wrong orders
                    created, and it has to be zero.
                  </p>
                  <pre className="mt-6 overflow-x-auto rounded-[10px] border border-line bg-panel px-4 py-3 font-mono text-[12.5px] leading-[1.8] text-fg-2">
                    <span className="text-fg-3"># replay this demo, no API key needed</span>
                    {"\n"}pnpm process --samples
                    {"\n\n"}
                    <span className="text-fg-3"># run it live and score it</span>
                    {"\n"}pnpm process
                    {"\n"}pnpm eval --split test
                  </pre>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ROI */}
        <section className="border-t border-line bg-panel/40">
          <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
            <SectionTitle kicker="Your numbers" title="What would it free up each month?" />
            <div className="mt-12">
              <RoiCalculator measuredPct={live ? (m.handledWithoutAPerson ?? null) : null} costPerEmailUsd={live ? m.costPerEmailUsd : null} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
          <h2 className="display max-w-[22ch] text-balance text-[34px] leading-[1.12] text-fg sm:text-[44px]">
            Have an inbox like this? Let’s measure yours.
          </h2>
          <p className="mt-5 max-w-[62ch] text-pretty text-[16px] leading-relaxed text-fg-2">
            I build systems like this for real operations: order intake, document extraction, support triage, back-office checks. Work usually
            starts with a five-day pilot on a sample of your own emails, so you see the numbers before you commit to more.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HireButton className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-4 py-2.5 text-[14px] font-medium text-canvas transition-colors duration-150 hover:bg-accent-bright">
              Hire me on Upwork
              <ArrowUpRight className="size-4" aria-hidden />
            </HireButton>
            {SOURCE_URL && (
              <a
                href={SOURCE_URL}
                className="inline-flex items-center gap-2 rounded-[6px] border border-fg-4 px-4 py-2.5 text-[14px] text-fg transition-colors duration-150 hover:bg-hover"
              >
                Read the source
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12.5px] text-fg-3 sm:px-6">
          <span>Built by Sandro T. All businesses, people and orders in this demo are fictional.</span>
          <span>{live ? `${m.model} · ${m.emails} held-out emails` : "Model output: recorded samples. Everything else: the real code."}</span>
        </div>
      </footer>
    </>
  );
}
