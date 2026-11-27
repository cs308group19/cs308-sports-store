import { useRef, type RefObject } from "react";
import { scrollProgress } from "../utils/motion";
import { useRafScroll } from "./useRafScroll";

/**
 * Follows the scroll through a pinned track: sets --p (0 to 1) on the element and returns the
 * latest value for animation loops.
 */
export function useScrollProgress(track: RefObject<HTMLElement | null>): RefObject<number> {
  const progress = useRef(0);
  useRafScroll(() => {
    const element = track.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    progress.current = scrollProgress(box.top, box.height, window.innerHeight);
    element.style.setProperty("--p", progress.current.toFixed(4));
  });
  return progress;
}
