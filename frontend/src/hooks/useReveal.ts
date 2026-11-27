import { useCallback } from "react";
import { prefersReducedMotion } from "./useMediaQuery";

let shared: IntersectionObserver | undefined;

/** One observer for the whole page. An element is revealed once and then left alone. */
function observer(): IntersectionObserver {
  shared ??= new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        self.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  return shared;
}

/**
 * A ref that slides its element up when it first enters the screen. Stagger items with the
 * --delay custom property. The element's className must not change, or React would drop the
 * classes added here. With reduced motion nothing is ever hidden.
 */
export function useReveal() {
  return useCallback((element: HTMLElement | null) => {
    if (!element || prefersReducedMotion() || element.classList.contains("is-visible")) return;
    element.classList.add("reveal");
    observer().observe(element);
    return () => observer().unobserve(element);
  }, []);
}
