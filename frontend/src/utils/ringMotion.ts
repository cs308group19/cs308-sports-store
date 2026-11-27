/** Pure math for turning the drop ring: wheel and drag input, momentum and arrow steps. */
import { clamp, ringSpinFor } from "./motion";

/** The ring's own speed in degrees per millisecond: one turn in 26 seconds, front card moving left. */
export const IDLE_SPEED = -360 / 26_000;
/** A pointer that moves less than this many pixels is a click, not a drag. */
export const DRAG_THRESHOLD = 6;
export const DRAG_DEG_PER_PX = 0.3;
export const WHEEL_DEG_PER_PX = 0.2;
/** The fastest the ring can be flung, in degrees per millisecond. */
export const MAX_FLING_SPEED = 0.5;
/** Time constant, in ms, for momentum to settle back into the ring's own speed. */
const MOMENTUM_MS = 300;
/** Time constant, in ms, for easing in a wheel or arrow turn. */
const TURN_MS = 110;
/** Only pointer movement this recent, in ms, counts towards a fling. */
const FLING_WINDOW_MS = 100;

export interface RingMotion {
  /** The ring's rotation in degrees. */
  spin: number;
  /** Degrees per millisecond. */
  speed: number;
  /** Degrees of a wheel or arrow turn that are still to be eased in. */
  pending: number;
}

/**
 * The sideways distance of a wheel event in pixels, or 0 when the event belongs to the page:
 * vertical and mostly vertical scrolling, and pinch zoom (which arrives with ctrlKey).
 */
export function sidewaysWheel(
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey" | "ctrlKey">,
): number {
  const { deltaX, deltaY, deltaMode, shiftKey, ctrlKey } = event;
  if (ctrlKey) return 0;
  // Shift turns a mouse wheel sideways. Some browsers report that in deltaX, others leave deltaY.
  const delta =
    shiftKey && deltaX === 0 ? deltaY : Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : 0;
  // deltaMode 1 counts lines and 2 counts pages.
  return delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
}

/** What a pointer has done so far, measured from where it went down. */
export function dragKind(dx: number, dy: number): "click" | "sideways" | "other" {
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return "click";
  return Math.abs(dx) > Math.abs(dy) ? "sideways" : "other";
}

/** The ring's speed when a drag is let go, from the latest pointer positions (x at time t). */
export function flingSpeed(samples: { x: number; t: number }[], releasedAt: number): number {
  const recent = samples.filter((sample) => releasedAt - sample.t <= FLING_WINDOW_MS);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.t <= first.t) return 0;
  const speed = ((last.x - first.x) / (last.t - first.t)) * DRAG_DEG_PER_PX;
  return clamp(speed, -MAX_FLING_SPEED, MAX_FLING_SPEED);
}

/** What is left of a difference after `elapsed` ms of exponential easing. */
const remaining = (elapsed: number, timeConstant: number) => Math.exp(-elapsed / timeConstant);

/**
 * One animation frame. The speed eases towards `idleSpeed` without ever jumping or overshooting,
 * and a share of the pending turn is made. The result does not depend on the frame rate.
 */
export function stepRing(motion: RingMotion, elapsed: number, idleSpeed: number): RingMotion {
  const speed = idleSpeed + (motion.speed - idleSpeed) * remaining(elapsed, MOMENTUM_MS);
  const pending = motion.pending * remaining(elapsed, TURN_MS);
  // The distance is the exact area under the easing speed.
  const travelled = idleSpeed * elapsed + (motion.speed - speed) * MOMENTUM_MS;
  return { spin: motion.spin + travelled + (motion.pending - pending), speed, pending };
}

/** The card nearest the front at this rotation. */
export function frontCard(spin: number, count: number): number {
  const index = Math.round((-spin * count) / 360) % count;
  return (index + count) % count;
}

/** The card before (-1) or after (1) this one, going round the ring. */
export function neighbourCard(index: number, count: number, direction: -1 | 1): number {
  return (index + direction + count) % count;
}

/** The shortest turn, in degrees, from the rotation `spin` that brings card `index` to the front. */
export function turnTo(index: number, count: number, spin: number): number {
  const difference = (ringSpinFor(index, count) - spin) % 360;
  return ((difference + 540) % 360) - 180;
}
