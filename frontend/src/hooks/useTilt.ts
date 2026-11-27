import { useEffect, useRef, type PointerEvent } from "react";
import { tiltAngles } from "../utils/motion";
import { prefersReducedMotion } from "./useMediaQuery";

/**
 * Pointer handlers that lean an element towards the mouse. The angles and the glare position are
 * written to CSS custom properties once per frame. Mouse only: nothing happens on touch screens
 * or with reduced motion.
 */
export function useTilt(max: number) {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return {
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" || prefersReducedMotion()) return;
      if (window.matchMedia("(hover: none)").matches) return;
      const element = event.currentTarget;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect();
        const x = clientX - box.left;
        const y = clientY - box.top;
        const { rx, ry } = tiltAngles(x, y, box.width, box.height, max);
        element.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        element.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        element.style.setProperty("--gx", `${((x / box.width) * 100 - 50).toFixed(1)}%`);
        element.style.setProperty("--gy", `${((y / box.height) * 100 - 50).toFixed(1)}%`);
        element.dataset.tilting = "true";
      });
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      const element = event.currentTarget;
      cancelAnimationFrame(frame.current);
      delete element.dataset.tilting;
      element.style.removeProperty("--rx");
      element.style.removeProperty("--ry");
    },
  };
}
