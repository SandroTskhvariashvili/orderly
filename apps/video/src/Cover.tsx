import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useVideoConfig } from "remotion";
import { Console, type DemoData, type DemoEmail } from "@orderly/ui";
import demoJson from "../../web/src/data/demo.json";
import { Backdrop, FontRoot } from "./kit.tsx";
import "./style.css";

const demo = demoJson as unknown as DemoData;
const byTime = [...demo.emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

// Same choice as the website: the richest clean order, with unit conversions.
const score = (e: DemoEmail) => e.lines.filter((l) => l.evidence).length + 3 * e.lines.filter((l) => l.conversion).length;
const hero = byTime.filter((e) => e.route === "create_draft" && e.lines.some((l) => l.conversion)).sort((a, b) => score(b) - score(a))[0]!;

/** Portfolio cover: name and one plain line over the real product. 4:3 for Upwork, 1280×769 ratio for Fiverr. */
export function Cover() {
  const { width, height } = useVideoConfig();
  const scale = width / 1760;
  // Remotion can capture before the console's own effect scrolls the inbox, so place the selected row here.
  const ref = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender("place inbox row"));
  useEffect(() => {
    requestAnimationFrame(() => {
      const list = ref.current?.querySelector<HTMLElement>('[role="listbox"]');
      const row = list?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (list && row) list.scrollTop = Math.max(0, row.offsetTop - 2 * row.offsetHeight);
      continueRender(handle);
    });
  }, [handle]);
  const wide = width / height > 1.5;
  return (
    <AbsoluteFill className="bg-canvas font-sans">
      <FontRoot />
      <Backdrop />
      <div style={{ position: "absolute", left: 80 * scale, top: 64 * scale, transform: `scale(${scale})`, transformOrigin: "0 0", width: 1600 }}>
        <div className={`display leading-[1.1] text-fg ${wide ? "text-[44px]" : "text-[70px]"}`}>Orderly</div>
        <div className={`mt-3 max-w-[1250px] leading-[1.4] text-fg-2 ${wide ? "text-[24px]" : "text-[34px]"}`}>
          Reads a wholesaler’s order emails, drafts the orders, and tells a person which ones to check and why.
        </div>
      </div>
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: 80 * scale,
          top: (wide ? 170 : 330) * scale,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <Console
          emails={byTime}
          mode={demo.mode}
          interactive={false}
          selectedId={hero.id}
          activeLine={0}
          className="h-[1100px] w-[1600px] shadow-[0_30px_80px_rgba(0,0,0,0.16)]"
        />
      </div>
    </AbsoluteFill>
  );
}
