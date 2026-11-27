/** Pure math behind the storefront's scroll, tilt and zoom effects. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How far the page has scrolled through a pinned track: 0 when the track's top reaches the top of
 * the viewport, 1 when its bottom reaches the bottom of the viewport. `trackTop` is the value of
 * getBoundingClientRect().top.
 */
export function scrollProgress(trackTop: number, trackHeight: number, viewportHeight: number): number {
  const distance = trackHeight - viewportHeight;
  if (distance <= 0) return trackTop <= 0 ? 1 : 0;
  return clamp(-trackTop / distance, 0, 1);
}

/** The angle of one card on a ring of `count` cards, and how bright it is at this ring rotation. */
export function ringCard(index: number, count: number, spin: number, minOpacity = 0.35) {
  const angle = (index * 360) / count;
  // 1 when the card faces the shopper, -1 when it is on the far side.
  const facing = Math.cos(((angle + spin) * Math.PI) / 180);
  return { angle, opacity: minOpacity + ((1 - minOpacity) * (facing + 1)) / 2 };
}

/** The ring rotation, in degrees, that turns card `index` to the front. */
export function ringSpinFor(index: number, count: number): number {
  return (-index * 360) / count;
}

/**
 * Tilt towards the pointer. (x, y) is the pointer inside a width × height box; the centre gives no
 * tilt and the edges give `max` degrees.
 */
export function tiltAngles(x: number, y: number, width: number, height: number, max: number) {
  if (width <= 0 || height <= 0) return { rx: 0, ry: 0 };
  return {
    rx: clamp((0.5 - y / height) * 2 * max, -max, max),
    ry: clamp((x / width - 0.5) * 2 * max, -max, max),
  };
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? clamp(zoom, MIN_ZOOM, MAX_ZOOM) : MIN_ZOOM;
}

/** Keeps a zoomed picture from being dragged further than its own edge. `size` is its unzoomed side. */
export function clampPan(offset: number, zoom: number, size: number): number {
  const limit = (size * (zoom - 1)) / 2;
  return clamp(offset, -limit, limit);
}
