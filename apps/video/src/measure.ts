import { useEffect, useLayoutEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export interface Point {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measures elements inside the stage, in untransformed stage pixels.
 * Runs on every frame, because the controlled console changes layout as the
 * story moves on, and Remotion may render any frame in isolation.
 */
export function useStagePoints(stage: React.RefObject<HTMLDivElement | null>, selectors: Record<string, string>, key: unknown) {
  const [points, setPoints] = useState<Record<string, Point> | null>(null);
  const [handle] = useState(() => delayRender("measure stage"));

  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const scale = box.width / root.offsetWidth || 1;
    const next: Record<string, Point> = {};
    for (const [name, sel] of Object.entries(selectors)) {
      const el = root.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[name] = {
        x: (r.left - box.left) / scale + r.width / scale / 2,
        y: (r.top - box.top) / scale + r.height / scale / 2,
        w: r.width / scale,
        h: r.height / scale,
      };
    }
    setPoints(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (points) continueRender(handle);
  }, [points, handle]);

  return points ?? {};
}
