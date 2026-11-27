import { prefersReducedMotion } from "../hooks/useMediaQuery";

/** Brings a section of the page into view, below the sticky header (scroll-margin-top in CSS). */
export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}
