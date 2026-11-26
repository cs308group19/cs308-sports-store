import { describe, expect, it } from "vitest";

import { cataloguePhoto, RENAMED_MODELS } from "./cataloguePhoto";

const MISSING = "/images/photo-unavailable.svg";

describe("cataloguePhoto", () => {
  it("finds the photo of a catalogue model", () => {
    expect(cataloguePhoto("NK-AF1-WHT")).toContain("NK-AF1-WHT");
  });

  it("shows the current photo for an order saved with an old model code", () => {
    expect(Object.keys(RENAMED_MODELS)).toHaveLength(12);
    for (const [oldModel, model] of Object.entries(RENAMED_MODELS)) {
      expect(cataloguePhoto(oldModel), oldModel).not.toBe(MISSING);
      expect(cataloguePhoto(oldModel), oldModel).toBe(cataloguePhoto(model));
    }
  });

  it("falls back to the placeholder for an unknown model", () => {
    expect(cataloguePhoto("NO-SUCH-MODEL")).toBe(MISSING);
  });
});
