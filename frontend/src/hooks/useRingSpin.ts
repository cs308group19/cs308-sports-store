import {
  useCallback,
  useEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ringCard } from "../utils/motion";
import {
  DRAG_DEG_PER_PX,
  IDLE_SPEED,
  WHEEL_DEG_PER_PX,
  dragKind,
  flingSpeed,
  frontCard,
  neighbourCard,
  sidewaysWheel,
  stepRing,
  turnTo,
  type RingMotion,
} from "../utils/ringMotion";

interface Drag {
  id: number;
  startX: number;
  startY: number;
  x: number;
  spinning: boolean;
  samples: { x: number; t: number }[];
}

/**
 * Turns the drop ring. It rotates by itself, follows sideways wheel, swipe and drag input and the
 * left and right arrow keys, and eases back into its own speed afterwards. It holds still while a
 * card or the ring has keyboard focus. With reduced motion it only moves when asked to, at once.
 *
 * Vertical scrolling is never touched: the wheel listener cancels sideways movement only, and the
 * ring area needs `touch-action: pan-y` in CSS.
 */
export function useRingSpin(still: boolean, count: number) {
  const area = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const motion = useRef<RingMotion>({ spin: 0, speed: IDLE_SPEED, pending: 0 });
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const held = useRef(false);

  /** Writes the rotation and each card's brightness to CSS custom properties. */
  const paint = useCallback(() => {
    const element = ring.current;
    if (!element) return;
    const { spin } = motion.current;
    element.style.setProperty("--spin", `${spin.toFixed(2)}deg`);
    element.querySelectorAll<HTMLElement>(".ring-card").forEach((card, index, cards) => {
      card.style.setProperty("--dim", ringCard(index, cards.length, spin).opacity.toFixed(3));
    });
  }, []);

  /** A turn asked for by the wheel or the keyboard: eased in, or made at once with reduced motion. */
  const turn = useCallback(
    (degrees: number) => {
      const { spin, pending } = motion.current;
      motion.current = still
        ? { spin: spin + degrees, speed: 0, pending: 0 }
        : { spin, speed: 0, pending: pending + degrees };
      if (still) paint();
    },
    [still, paint],
  );

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    if (still) {
      const { spin, pending } = motion.current;
      motion.current = { spin: spin + pending, speed: 0, pending: 0 };
      paint();
      return;
    }
    paint();
    let frame = 0;
    let last = 0;
    const animate = (time: number) => {
      const elapsed = last ? Math.min(time - last, 100) : 0;
      last = time;
      // While it is being dragged, the ring only follows the pointer.
      if (!drag.current?.spinning) {
        motion.current = stepRing(motion.current, elapsed, held.current ? 0 : IDLE_SPEED);
      }
      paint();
      frame = requestAnimationFrame(animate);
    };
    // The loop only runs while the ring is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      last = 0;
      if (entry.isIntersecting) frame = requestAnimationFrame(animate);
    });
    visibility.observe(element);
    return () => {
      visibility.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [still, count, paint]);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    // Added by hand because React's wheel listener cannot cancel the browser's own scrolling.
    const onWheel = (event: WheelEvent) => {
      const sideways = sidewaysWheel(event);
      if (!sideways) return;
      event.preventDefault();
      turn(-sideways * WHEEL_DEG_PER_PX);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [turn]);

  const cardButtons = () =>
    Array.from(area.current?.querySelectorAll<HTMLElement>("button.ring-card") ?? []);

  const show = (index: number, total: number) => {
    const { spin, pending } = motion.current;
    turn(turnTo(index, total, spin + pending));
  };

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      swallowClick.current = false;
      if (!event.isPrimary || event.button !== 0) return;
      // A press catches a flung ring. At its own pace the ring just carries on turning.
      if (Math.abs(motion.current.speed) > 2 * Math.abs(IDLE_SPEED)) {
        motion.current = { spin: motion.current.spin, speed: 0, pending: 0 };
      }
      const { pointerId: id, clientX: x, clientY } = event;
      drag.current = { id, startX: x, startY: clientY, x, spinning: false, samples: [] };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.id) return;
      // The mouse button was let go somewhere the ring could not hear it.
      if (event.pointerType === "mouse" && !(event.buttons & 1)) {
        drag.current = null;
        return;
      }
      const x = event.clientX;
      if (!current.spinning) {
        const kind = dragKind(x - current.startX, event.clientY - current.startY);
        if (kind === "click") return;
        swallowClick.current = true;
        if (kind !== "sideways") return;
        current.spinning = true;
        // Start from here, so the ring does not jump by the distance already moved.
        current.x = x;
        event.currentTarget.setPointerCapture(current.id);
      }
      const spin = motion.current.spin + (x - current.x) * DRAG_DEG_PER_PX;
      motion.current = { spin, speed: 0, pending: 0 };
      current.x = x;
      current.samples = [...current.samples.slice(-9), { x, t: event.timeStamp }];
      if (still) paint();
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.id) return;
      drag.current = null;
      if (current.spinning && !still) {
        motion.current.speed = flingSpeed(current.samples, event.timeStamp);
      }
    },
    /** The browser took the gesture over, usually to scroll the page. */
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.id === event.pointerId) drag.current = null;
    },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      // detail is 0 for a click made with the keyboard, which is never the end of a drag.
      if (!swallowClick.current || event.detail === 0) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (!event.target.matches(":focus-visible")) return;
      held.current = true;
      // Turn a focused card to the front and keep it there.
      const cards = cardButtons();
      const index = cards.indexOf(event.target);
      if (index >= 0) show(index, cards.length);
    },
    onBlur: () => {
      held.current = false;
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const cards = cardButtons();
      if (!cards.length) return;
      event.preventDefault();
      const focused = cards.indexOf(event.target as HTMLElement);
      const { spin, pending } = motion.current;
      const from = focused >= 0 ? focused : frontCard(spin + pending, cards.length);
      const next = neighbourCard(from, cards.length, event.key === "ArrowRight" ? 1 : -1);
      if (focused >= 0) cards[next].focus({ preventScroll: true });
      held.current = true;
      show(next, cards.length);
    },
  };

  return { area, ring, handlers };
}
