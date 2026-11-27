import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { clampPan, clampZoom, MAX_ZOOM, MIN_ZOOM } from "../../utils/motion";
import { Icon } from "./Icon";

const STEP = 0.5;
const PAN_STEP = 40;
/** A pointer that moved further than this was a drag, not a click. */
const DRAG_THRESHOLD = 4;

/**
 * The full-screen photo viewer: wheel, buttons, double-click and pinch zoom between 1x and 4x,
 * dragging pans, and Escape, the close button or a click on the backdrop closes it.
 */
export function ImageZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  /** The current view, kept outside React state because it changes on every pointer move. */
  const view = useRef({ zoom: MIN_ZOOM, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const travelled = useRef(0);
  const [zoomLabel, setZoomLabel] = useState(MIN_ZOOM);

  const show = (zoom: number, x: number, y: number) => {
    const element = image.current;
    if (!element) return;
    const next = clampZoom(zoom);
    view.current = {
      zoom: next,
      x: clampPan(x, next, element.offsetWidth),
      y: clampPan(y, next, element.offsetHeight),
    };
    element.style.setProperty("--zoom", String(next));
    element.style.setProperty("--x", `${view.current.x}px`);
    element.style.setProperty("--y", `${view.current.y}px`);
    element.dataset.zoomed = String(next > MIN_ZOOM);
    setZoomLabel(next);
  };
  const zoomBy = (change: number) => show(view.current.zoom + change, view.current.x, view.current.y);
  const panBy = (x: number, y: number) => show(view.current.zoom, view.current.x + x, view.current.y + y);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Added by hand because React's wheel listener cannot stop the page from scrolling.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      show(view.current.zoom * Math.exp(-event.deltaY * 0.002), view.current.x, view.current.y);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      document.body.style.overflow = overflow;
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "+" || event.key === "=") zoomBy(STEP);
    else if (event.key === "-") zoomBy(-STEP);
    else if (event.key === "ArrowLeft") panBy(PAN_STEP, 0);
    else if (event.key === "ArrowRight") panBy(-PAN_STEP, 0);
    else if (event.key === "ArrowUp") panBy(0, PAN_STEP);
    else if (event.key === "ArrowDown") panBy(0, -PAN_STEP);
    else if (event.key === "Tab") {
      // Keep the focus inside the dialog.
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (buttons.length === 0) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next].focus();
    } else return;
    event.preventDefault();
  };

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (pointers.current.size === 0) travelled.current = 0;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) pinch.current = { distance: distance(), zoom: view.current.zoom };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    travelled.current += Math.abs(dx) + Math.abs(dy);
    if (pointers.current.size === 2 && pinch.current) {
      show((pinch.current.zoom * distance()) / pinch.current.distance, view.current.x, view.current.y);
    } else if (pointers.current.size === 1 && view.current.zoom > MIN_ZOOM) {
      panBy(dx, dy);
    }
  };

  const onPointerEnd = (event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return createPortal(
    <div
      ref={dialog}
      className="zoom"
      role="dialog"
      aria-modal="true"
      aria-label={`Zoomed photo of ${alt}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={onPointerEnd}
      onClick={(event) => {
        if (event.target === dialog.current && travelled.current <= DRAG_THRESHOLD) onClose();
      }}
    >
      <img
        ref={image}
        src={src}
        alt={alt}
        draggable={false}
        onDoubleClick={() => (view.current.zoom >= MAX_ZOOM ? show(MIN_ZOOM, 0, 0) : zoomBy(STEP * 2))}
      />
      <div className="zoom-controls">
        <button aria-label="Zoom out" disabled={zoomLabel <= MIN_ZOOM} onClick={() => zoomBy(-STEP)}>
          −
        </button>
        <b aria-live="polite">{Math.round(zoomLabel * 100)}%</b>
        <button aria-label="Zoom in" disabled={zoomLabel >= MAX_ZOOM} onClick={() => zoomBy(STEP)}>
          +
        </button>
      </div>
      <button ref={closeButton} className="zoom-close" aria-label="Close zoom" onClick={onClose}>
        <Icon name="close" />
      </button>
    </div>,
    document.body,
  );
}
