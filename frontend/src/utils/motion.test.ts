import { describe, expect, it } from "vitest";
import {
  clampPan,
  clampZoom,
  ringCard,
  ringSpinFor,
  tiltAngles,
} from "./motion";

describe("ringCard", () => {
  it("spaces six cards 60 degrees apart", () => {
    expect([0, 1, 5].map((i) => ringCard(i, 6, 0).angle)).toEqual([0, 60, 300]);
  });

  it("is brightest at the front and dimmest at the back", () => {
    expect(ringCard(0, 6, 0).opacity).toBe(1);
    expect(ringCard(3, 6, 0).opacity).toBeCloseTo(0.35);
    expect(ringCard(1, 6, 0).opacity).toBeGreaterThan(ringCard(2, 6, 0).opacity);
  });

  it("follows the rotation of the ring", () => {
    expect(ringCard(3, 6, -180).opacity).toBeCloseTo(1);
    expect(ringCard(0, 6, -360).opacity).toBeCloseTo(1);
  });

  it("turns a chosen card to the front", () => {
    for (const index of [0, 2, 5]) {
      expect(ringCard(index, 6, ringSpinFor(index, 6)).opacity).toBeCloseTo(1);
    }
  });
});

describe("tiltAngles", () => {
  it("does not tilt at the centre", () => {
    expect(tiltAngles(100, 50, 200, 100, 8)).toEqual({ rx: 0, ry: 0 });
  });

  it("leans towards the pointer, up to the maximum at the corners", () => {
    expect(tiltAngles(0, 0, 200, 100, 8)).toEqual({ rx: 8, ry: -8 });
    expect(tiltAngles(200, 100, 200, 100, 8)).toEqual({ rx: -8, ry: 8 });
  });

  it("stays within the maximum outside the box", () => {
    expect(tiltAngles(900, -400, 200, 100, 10)).toEqual({ rx: 10, ry: 10 });
  });

  it("does not tilt a box without a size", () => {
    expect(tiltAngles(10, 10, 0, 0, 8)).toEqual({ rx: 0, ry: 0 });
  });
});

describe("clampZoom", () => {
  it("cannot go below 1x or above 4x", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(-3)).toBe(1);
    expect(clampZoom(9)).toBe(4);
  });

  it("keeps a zoom inside the range", () => {
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it("falls back to 1x for a value that is not a number", () => {
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("clampPan", () => {
  it("cannot move a picture that is not zoomed", () => {
    expect(Math.abs(clampPan(80, 1, 600))).toBe(0);
  });

  it("stops at the edge of the zoomed picture", () => {
    expect(clampPan(900, 2, 600)).toBe(300);
    expect(clampPan(-900, 2, 600)).toBe(-300);
    expect(clampPan(120, 2, 600)).toBe(120);
  });
});
