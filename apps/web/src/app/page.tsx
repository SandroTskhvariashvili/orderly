import { ArrowUpRight } from "lucide-react";
import { ComparisonTable, Console, FailuresTable, HeadlineNumbers, MetricsTable, type DemoData } from "@orderly/ui";
import { Pipeline } from "@/components/pipeline";
import { RoiCalculator } from "@/components/roi";
import { SOURCE_URL, UPWORK_URL } from "@/site";
import demoJson from "@/data/demo.json";

const demo = demoJson as unknown as DemoData;

function SectionTitle({ id, kicker, title, children }: { id?: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header id={id} className="max-w-[720px]">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-accent-bright">{kicker}</p>
      <h2 className="serif-display mt-3 text-balance text-[34px] leading-[1.12] text-fg sm:text-[40px]">{title}</h2>
      {children && <div className="mt-4 text-[16px] leading-relaxed text-fg-2">{children}</div>}
    </header>
  );
}

export default function Page() {
  const m = demo.metrics;
  const injection = demo.emails.find((e) => e.issues.some((i) => i.reason === "suspicious_instructions"));
  const firstInteresting =
    demo.emails.find((e) => e.basedOnOrderId && e.route === "create_draft") ?? demo.emails.find((e) => e.route === "create_draft");

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
              Results
            </a>
            <a href={SOURCE_URL} className="hidden px-2 py-1 text-fg-2 hover:text-fg md:inline">
              Source
            </a>
            <a
              href={UPWORK_URL}
              className="rounded-[6px] bg-accent px-3 py-1.5 font-medium text-canvas transition-colors duration-150 hover:bg-accent-bright"
            >
              Work with me
            </a>
          </div>
        </div>
      </nav>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto max-w-[1320px] px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="text-[13px] text-fg-3">A working demo by Sandro T., AI and full-stack engineer</p>
          <h1 className="serif-display mt-5 max-w-[1180px] text-balance text-[44px] leading-[1.04] text-fg sm:text-[64px] lg:text-[76px]">
            Order emails in. Draft orders out.{" "}
            <em className="italic text-accent-bright lg:block">The doubtful ones come to you.</em>
          </h1>
          <p className="mt-7 max-w-[640px] text-[17px] leading-relaxed text-fg-2">
            Orderly reads a wholesaler&apos;s order inbox, checks every line against the catalog and the customer&apos;s history, and
            creates draft orders. When something is unclear, unusual or suspicious, it stops and tells a person why.
          </p>
          <div className="mt-14">
            <HeadlineNumbers data={demo} />
          </div>
          <p className="mt-6 text-[12.5px] text-fg-3">
            Measured on {m.emails} emails that were held back while it was built. All businesses and people in this demo are fictional.
          </p>
        </section>

        {/* Console */}
        <section className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-6">
          <SectionTitle id="console" kicker="The inbox" title="One week of order emails, already processed">
            60 emails from Monday to Friday. Pick one and hover a line of the order: the words it came from light up in the email.
            Switch to <span className="text-fg">What the model saw</span> to see what was hidden before any model call.
          </SectionTitle>
          <Console emails={demo.emails} initialId={firstInteresting?.id} className="mt-10 lg:h-[760px]" />
        </section>

        {/* How it decides */}
        <section className="border-t border-line bg-panel/40">
          <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
            <SectionTitle id="how" kicker="How it decides" title={<>The model reads. <em className="italic">Code decides.</em></>}>
              It is a workflow with a model at two steps, not a free-roaming agent. That is the reason it can be trusted with orders.
            </SectionTitle>
            <div className="mt-12">
              <Pipeline />
            </div>
            <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
              <div>
                <h3 className="text-[16px] font-semibold text-fg">It cannot write</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  The model can search the catalog and look up this customer&apos;s orders. It cannot create an order, send an email or
                  see another customer. Twelve plain checks decide where each email goes, so every decision can be replayed and tested.
                </p>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-fg">Every value points to its source</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  Each order line carries the exact words it came from. If those words are not in the email, the line goes to review.
                  The model cannot invent a quantity and cite it.
                </p>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-fg">Contact details never reach the model</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  Phone numbers, email addresses, IBANs and street addresses are replaced with placeholders first. Names stay, so a reply
                  can greet someone.
                </p>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-fg">Instructions inside an email are just text</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
                  {injection ? (
                    <>
                      One email in this set says{" "}
                      <span className="text-fg">
                        {injection.issues.find((i) => i.reason === "suspicious_instructions")?.message.match(/"(.+)"/)?.[1] ??
                          "to approve itself"}
                      </span>
                      . It was not followed. It was flagged for a person, like every attempt in the test set.
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
        </section>

        {/* ROI */}
        <section className="border-t border-line bg-panel/40">
          <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
            <SectionTitle kicker="Your numbers" title="What would it free up in your week?" />
            <div className="mt-12">
              <RoiCalculator automatedPct={m.handledWithoutAPerson ?? 0} costPerEmailUsd={m.costPerEmailUsd} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6">
          <div className="max-w-[760px]">
            <h2 className="serif-display text-balance text-[36px] leading-[1.1] text-fg sm:text-[48px]">
              Have an inbox like this? <em className="italic text-accent-bright">Let&apos;s measure yours.</em>
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-fg-2">
              I build agents like this for real operations: order intake, document extraction, support triage, back-office checks. Work
              usually starts with a five-day pilot on your own emails, with the accuracy target agreed before I begin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={UPWORK_URL}
                className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-4 py-2.5 text-[14px] font-medium text-canvas transition-colors duration-150 hover:bg-accent-bright"
              >
                Hire me on Upwork
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <a
                href={SOURCE_URL}
                className="inline-flex items-center gap-2 rounded-[6px] border border-line-strong px-4 py-2.5 text-[14px] text-fg transition-colors duration-150 hover:bg-hover"
              >
                Read the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12.5px] text-fg-3 sm:px-6">
          <span>Built by Sandro T. All businesses, people and orders in this demo are fictional.</span>
          <span className="tabular">
            {m.model} · {m.emails} held-out emails · ${m.costPerEmailUsd.toFixed(3)} per email
          </span>
        </div>
      </footer>
    </>
  );
}
