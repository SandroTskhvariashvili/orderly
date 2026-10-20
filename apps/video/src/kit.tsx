// Small building blocks for a screen-studio style walkthrough rendered from the
// real components: a camera that eases between framings, a cursor that glides
// and clicks, and captions set like an editorial lower third.

import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const sans = loadPlexSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadPlexMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

// The theme resolves --font-sans etc. on :root, so the font variables must live on :root too.
export function FontRoot() {
  return <style>{`:root{--font-plex-sans:"${sans.fontFamily}";--font-plex-mono:"${mono.fontFamily}";}`}</style>;
}

export const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Smooth value between keyframes [frame, value]. */
export function useKeyframes(keys: Array<[number, number]>): number {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
    { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

export interface Shot {
  at: number;
  /** Point of the stage to centre, in stage pixels. */
  x: number;
  y: number;
  zoom: number;
}

/** Eases between framings of a fixed-size stage, like a screen recorder's auto-zoom. */
export function Camera({ shots, stage, children }: { shots: Shot[]; stage: { w: number; h: number }; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pick = (k: "x" | "y" | "zoom") =>
    interpolate(
      frame,
      shots.map((s) => s.at),
      shots.map((s) => s[k]),
      { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  const zoom = pick("zoom");
  const tx = width / 2 - pick("x") * zoom;
  const ty = height / 2 - pick("y") * zoom;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: stage.w,
          height: stage.h,
          transformOrigin: "0 0",
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

export interface CursorKey {
  at: number;
  x: number;
  y: number;
  click?: boolean;
}

/** A macOS-style pointer that glides between points on the stage and pulses on click. */
export function Cursor({ keys }: { keys: CursorKey[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = interpolate(frame, keys.map((k) => k.at), keys.map((k) => k.x), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, keys.map((k) => k.at), keys.map((k) => k.y), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lastClick = [...keys].reverse().find((k) => k.click && k.at <= frame);
  const t = lastClick ? frame - lastClick.at : 999;
  const press = lastClick ? spring({ frame: t, fps, config: { damping: 18, stiffness: 260 }, durationInFrames: 14 }) : 1;
  const ring = t < 24 ? interpolate(t, [0, 24], [0, 1]) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      {t < 24 && (
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "2px solid rgba(31,111,74,0.85)",
            opacity: 1 - ring,
            transform: `scale(${0.4 + ring * 0.9})`,
          }}
        />
      )}
      <svg
        width="26"
        height="30"
        viewBox="0 0 26 30"
        style={{ transform: `scale(${t < 14 ? 0.86 + 0.14 * press : 1})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))" }}
      >
        <path d="M2 2 L2 24 L8 18.5 L12.2 27.5 L16 25.8 L11.9 17 L20 17 Z" fill="#111111" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Lower-third caption: one plain line on a paper card, fades and lifts in. */
export function Caption({ from, to, children, top = false }: { from: number; to: number; children: React.ReactNode; top?: boolean }) {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [from, from + 18], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outP = interpolate(frame, [to - 14, to], [1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < from || frame > to) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        ...(top ? { top: 72 } : { bottom: 84 }),
        zIndex: 60,
        opacity: Math.min(inP, outP),
        transform: `translateY(${(1 - inP) * 14}px)`,
      }}
    >
      <div
        style={{
          fontSize: 46,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          color: "#1d1c19",
          padding: "18px 26px 20px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.08), 0 18px 40px rgba(0,0,0,0.14)",
          maxWidth: 1300,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Backdrop() {
  return (
    <AbsoluteFill
      style={{
        background: "#e6e2d8",
      }}
    />
  );
}
