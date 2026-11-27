import type { HomeSection } from "../components/layout/Header";

/** Home page sections that have a matching tab in the main header navigation. */
export type NavHomeSection = "brands" | "sports" | "journal" | "sale";

export const NAV_HOME_SECTIONS: readonly NavHomeSection[] = ["brands", "sports", "journal", "sale"];

/** Viewport Y offset (just below the sticky header) used to decide which section is active. */
export const NAV_SCROLL_OFFSET = 140;

/** Distance from the bottom of the document within which #sale counts as active. */
const BOTTOM_THRESHOLD = 24;

export interface SectionRect {
  id: NavHomeSection;
  top: number;
  bottom: number;
}

export function isNavHomeSection(section: HomeSection | null): section is NavHomeSection {
  return section !== null && (NAV_HOME_SECTIONS as readonly string[]).includes(section);
}

/**
 * Picks the header tab whose home section currently sits under the reading line.
 * Returns null above #brands (hero / drop) and in non-tabbed sections (trending / gear).
 */
export function pickActiveHomeSection(
  sections: readonly SectionRect[],
  viewportHeight: number,
  atBottom: boolean,
): NavHomeSection | null {
  if (atBottom) {
    const sale = sections.find((section) => section.id === "sale");
    if (sale && sale.top <= viewportHeight * 0.65 && sale.bottom > 0) {
      return "sale";
    }
  }

  for (const section of sections) {
    if (section.top <= NAV_SCROLL_OFFSET && section.bottom > NAV_SCROLL_OFFSET) {
      return section.id;
    }
  }

  return null;
}

/** Reads the live DOM bounding boxes of the home sections and returns the active tab, if any. */
export function detectActiveHomeSection(): NavHomeSection | null {
  const rects: SectionRect[] = [];
  for (const id of NAV_HOME_SECTIONS) {
    const element = document.getElementById(id);
    if (!element) continue;
    const box = element.getBoundingClientRect();
    rects.push({ id, top: box.top, bottom: box.bottom });
  }
  const atBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - BOTTOM_THRESHOLD;
  return pickActiveHomeSection(rects, window.innerHeight, atBottom);
}
