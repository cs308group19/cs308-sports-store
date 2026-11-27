import { prefersReducedMotion } from "../hooks/useMediaQuery";

const DURATION_MS = 750;
const SIZE = 120;

/** Gives the cart badge a short bounce. */
function pop(target: HTMLElement) {
  target.classList.remove("is-pop");
  void target.offsetWidth; // Restarts the animation if the last one is still marked.
  target.classList.add("is-pop");
}

/**
 * Sends a copy of a product photo in an arc to the cart button in the header. Purely decorative:
 * it runs beside the add-to-cart request and never waits for it.
 */
export function flyToCart(photo: HTMLImageElement | null | undefined): void {
  const target = document.querySelector<HTMLElement>("[data-cart-target]");
  if (!photo || !target || prefersReducedMotion() || !photo.animate) return;

  const from = photo.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(SIZE, from.width);
  const left = from.left + (from.width - size) / 2;
  const top = from.top + (from.height - size) / 2;
  const x = to.left + to.width / 2 - (left + size / 2);
  const y = to.top + to.height / 2 - (top + size / 2);

  const copy = document.createElement("img");
  copy.src = photo.currentSrc || photo.src;
  copy.alt = "";
  copy.className = "flyer";
  Object.assign(copy.style, { left: `${left}px`, top: `${top}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(copy);

  const flight = copy.animate(
    [
      { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
      // The extra height in the middle makes the path an arc.
      { transform: `translate(${x * 0.55}px, ${y * 0.85 - 60}px) scale(0.5)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x}px, ${y}px) scale(0.08)`, opacity: 0.2 },
    ],
    { duration: DURATION_MS, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
  );
  flight.onfinish = () => {
    copy.remove();
    pop(target);
  };
  flight.oncancel = () => copy.remove();
}
