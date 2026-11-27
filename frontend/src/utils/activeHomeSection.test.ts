import { describe, expect, it } from "vitest";
import {
  isNavHomeSection,
  pickActiveHomeSection,
  type SectionRect,
} from "./activeHomeSection";

describe("isNavHomeSection", () => {
  it("accepts only sections shown in the header navigation", () => {
    expect(isNavHomeSection("brands")).toBe(true);
    expect(isNavHomeSection("sports")).toBe(true);
    expect(isNavHomeSection("journal")).toBe(true);
    expect(isNavHomeSection("sale")).toBe(true);
    expect(isNavHomeSection("drop")).toBe(false);
    expect(isNavHomeSection("trending")).toBe(false);
    expect(isNavHomeSection(null)).toBe(false);
  });
});

describe("pickActiveHomeSection", () => {
  it("returns null at the top of the homepage (above #brands)", () => {
    const sections: SectionRect[] = [
      { id: "brands", top: 1800, bottom: 2300 },
      { id: "sports", top: 2300, bottom: 3100 },
      { id: "journal", top: 4200, bottom: 4800 },
      { id: "sale", top: 4800, bottom: 5240 },
    ];
    expect(pickActiveHomeSection(sections, 900, false)).toBeNull();
  });

  it("highlights the section aligned under the sticky header", () => {
    const atBrands: SectionRect[] = [
      { id: "brands", top: 80, bottom: 580 },
      { id: "sports", top: 580, bottom: 1380 },
      { id: "journal", top: 2480, bottom: 3080 },
      { id: "sale", top: 3080, bottom: 3520 },
    ];
    expect(pickActiveHomeSection(atBrands, 900, false)).toBe("brands");

    const atSports: SectionRect[] = [
      { id: "brands", top: -420, bottom: 80 },
      { id: "sports", top: 80, bottom: 880 },
      { id: "journal", top: 1980, bottom: 2580 },
      { id: "sale", top: 2580, bottom: 3020 },
    ];
    expect(pickActiveHomeSection(atSports, 900, false)).toBe("sports");

    const atJournal: SectionRect[] = [
      { id: "brands", top: -2320, bottom: -1820 },
      { id: "sports", top: -1820, bottom: -1020 },
      { id: "journal", top: 80, bottom: 680 },
      { id: "sale", top: 680, bottom: 1120 },
    ];
    expect(pickActiveHomeSection(atJournal, 900, false)).toBe("journal");
  });

  it("returns null in non-tabbed sections between Sports and Journal", () => {
    const betweenSportsAndJournal: SectionRect[] = [
      { id: "brands", top: -1500, bottom: -1000 },
      { id: "sports", top: -1000, bottom: -200 },
      { id: "journal", top: 500, bottom: 1100 },
      { id: "sale", top: 1100, bottom: 1540 },
    ];
    expect(pickActiveHomeSection(betweenSportsAndJournal, 900, false)).toBeNull();
  });

  it("highlights #sale at the bottom of tall viewports even when #sale sits below the header offset", () => {
    const atBottomTallViewport: SectionRect[] = [
      { id: "brands", top: -2700, bottom: -2200 },
      { id: "sports", top: -2200, bottom: -1400 },
      { id: "journal", top: -280, bottom: 320 },
      { id: "sale", top: 320, bottom: 760 },
    ];
    expect(pickActiveHomeSection(atBottomTallViewport, 1080, true)).toBe("sale");
  });
});
