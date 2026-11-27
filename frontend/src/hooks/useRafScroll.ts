import { useEffect, useRef } from "react";

/**
 * Calls `onFrame` once now and then at most once per animation frame while the page scrolls or
 * resizes. Per-frame values belong on elements (style.setProperty), not in React state.
 */
export function useRafScroll(onFrame: () => void) {
  const callback = useRef(onFrame);
  callback.current = onFrame;

  // Every render applies the current values again, so a re-render never leaves them stale.
  useEffect(() => {
    callback.current();
  });

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        callback.current();
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
}
