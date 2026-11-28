import { describe, expect, it } from "vitest";
import {
  DRAG_THRESHOLD,
  IDLE_SPEED,
  MAX_FLING_SPEED,
  dragKind,
  flingSpeed,
  frontCard,
  neighbourCard,
  sidewaysWheel,
  stepRing,
  turnTo,
  type RingMotion,
} from "./ringMotion";

/** SCRUM-115. The drop ring takes sideways input only and eases back into its own turning. */
describe("sidewaysWheel", () => {
  const wheel = (deltaX: number, deltaY: number, more: Partial<WheelEvent> = {}) =>
    sidewaysWheel({ deltaX, deltaY, deltaMode: 0, shiftKey: false, ctrlKey: false, ...more });

  it("takes a sideways trackpad swipe, in both directions", () => {
    expect(wheel(40, 0)).toBe(40);
    expect(wheel(-40, 6)).toBe(-40);
  });

  it("leaves vertical scrolling to the page", () => {
    expect(wheel(0, 100)).toBe(0);
    expect(wheel(0, -100)).toBe(0);
    expect(wheel(12, 40)).toBe(0);
    expect(wheel(0, 0)).toBe(0);
  });

  it("leaves an even diagonal to the page", () => {
    expect(wheel(20, 20)).toBe(0);
    expect(wheel(-20, 20)).toBe(0);
  });

  it("takes Shift + mouse wheel, however the browser reports it", () => {
    expect(wheel(0, 100, { shiftKey: true })).toBe(100);
    expect(wheel(0, -100, { shiftKey: true })).toBe(-100);
    expect(wheel(100, 0, { shiftKey: true })).toBe(100);
  });

  it("ignores pinch zoom", () => {
    expect(wheel(30, 2, { ctrlKey: true })).toBe(0);
  });

  it("converts lines and pages to pixels", () => {
    expect(wheel(0, 3, { shiftKey: true, deltaMode: 1 })).toBe(48);
    expect(wheel(1, 0, { deltaMode: 2 })).toBe(400);
  });
});

describe("dragKind", () => {
  it(`is a click while the pointer has moved less than ${DRAG_THRESHOLD}px`, () => {
    expect(dragKind(0, 0)).toBe("click");
    expect(dragKind(5.9, 0)).toBe("click");
    expect(dragKind(-3, 4)).toBe("click");
  });

  it("is a sideways drag from the threshold on", () => {
    expect(dragKind(6, 0)).toBe("sideways");
    expect(dragKind(-30, 10)).toBe("sideways");
  });

  it("is neither a click nor a spin when it moves up or down", () => {
    expect(dragKind(0, 6)).toBe("other");
    expect(dragKind(5, -40)).toBe("other");
  });
});

describe("flingSpeed", () => {
  // 200px in 80ms.
  const samples = [0, 20, 40, 60, 80].map((t) => ({ x: t * 2.5, t }));

  it("follows the pointer's latest speed and direction", () => {
    const slow = samples.map(({ x, t }) => ({ x: x / 5, t }));
    expect(flingSpeed(slow, 85)).toBeCloseTo(0.15);
    expect(flingSpeed(slow.map(({ x, t }) => ({ x: -x, t })), 85)).toBeCloseTo(-0.15);
  });

  it("is limited", () => {
    expect(flingSpeed(samples, 85)).toBe(MAX_FLING_SPEED);
  });

  it("is nothing when the pointer was held still before letting go", () => {
    expect(flingSpeed(samples, 400)).toBe(0);
    expect(flingSpeed([], 0)).toBe(0);
    expect(flingSpeed([{ x: 10, t: 5 }], 6)).toBe(0);
  });
});

describe("momentum easing", () => {
  const run = (from: RingMotion, ms: number, frame = 16, idle = IDLE_SPEED) => {
    const frames = [from];
    for (let t = 0; t < ms; t += frame) frames.push(stepRing(frames.at(-1)!, frame, idle));
    return frames;
  };
  const flung: RingMotion = { spin: 0, speed: 0.4, pending: 0 };

  it("slows from a fling into the ring's own speed without overshooting", () => {
    const speeds = run(flung, 4000).map((m) => m.speed);
    speeds.slice(1).forEach((speed, i) => {
      expect(speed).toBeLessThan(speeds[i]);
      expect(speed).toBeGreaterThanOrEqual(IDLE_SPEED);
    });
    expect(speeds.at(-1)).toBeCloseTo(IDLE_SPEED, 5);
  });

  it("starts turning again, gently, after standing still", () => {
    const frames = run({ spin: 0, speed: 0, pending: 0 }, 3000);
    expect(Math.abs(frames[1].speed)).toBeLessThan(Math.abs(IDLE_SPEED) / 10);
    expect(frames.at(-1)!.speed).toBeCloseTo(IDLE_SPEED, 5);
  });

  it("never jumps: one frame moves about one frame's worth", () => {
    const next = stepRing(flung, 16, IDLE_SPEED);
    expect(next.spin).toBeGreaterThan(0.3 * 16);
    expect(next.spin).toBeLessThanOrEqual(0.4 * 16);
    expect(stepRing(flung, 0, IDLE_SPEED)).toEqual(flung);
  });

  it("does not depend on the frame rate", () => {
    const fast = run(flung, 480, 8).at(-1)!;
    const slow = run(flung, 480, 48).at(-1)!;
    expect(fast.spin).toBeCloseTo(slow.spin);
    expect(fast.speed).toBeCloseTo(slow.speed);
  });

  it("eases a wheel or arrow turn in completely", () => {
    const frames = run({ spin: 10, speed: 0, pending: -60 }, 2000, 16, 0);
    expect(frames[1].spin).toBeGreaterThan(-15);
    expect(frames.at(-1)!.spin).toBeCloseTo(-50, 4);
    expect(frames.at(-1)!.pending).toBeCloseTo(0, 4);
  });

  it("comes to rest when the ring is held", () => {
    const last = run(flung, 4000, 16, 0).at(-1)!;
    expect(last.speed).toBeCloseTo(0, 5);
  });
});

describe("arrow steps", () => {
  it("finds the card at the front", () => {
    expect([0, -60, -110, 60, -360, 485].map((spin) => frontCard(spin, 6))).toEqual([
      0, 1, 2, 5, 0, 4,
    ]);
  });

  it("goes round the ring", () => {
    expect(neighbourCard(5, 6, 1)).toBe(0);
    expect(neighbourCard(0, 6, -1)).toBe(5);
    expect(neighbourCard(2, 6, 1)).toBe(3);
  });

  it("takes the shortest way to a card, after any number of turns", () => {
    expect(turnTo(1, 6, 0)).toBeCloseTo(-60);
    expect(turnTo(5, 6, 0)).toBeCloseTo(60);
    expect(turnTo(0, 6, -3590)).toBeCloseTo(-10);
    expect(turnTo(0, 6, 725)).toBeCloseTo(-5);
  });

  it("lands the chosen card at the front", () => {
    for (const spin of [-1234.5, -30, 0, 77, 900]) {
      for (let index = 0; index < 6; index++) {
        expect(frontCard(spin + turnTo(index, 6, spin), 6)).toBe(index);
      }
    }
  });
});
