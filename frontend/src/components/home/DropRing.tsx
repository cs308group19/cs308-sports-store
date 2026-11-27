import { useEffect, useRef } from "react";
import type { Product } from "../../types/models";
import { REDUCED_MOTION, useMediaQuery } from "../../hooks/useMediaQuery";
import { useReveal } from "../../hooks/useReveal";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import { brandOf } from "../../utils/brands";
import { shortMoney } from "../../utils/format";
import { ringCard, ringSpinFor } from "../../utils/motion";
import { Skeleton } from "../ui/Skeleton";

export const RING_SIZE = 6;
/** One idle turn of the ring takes this long; scrolling through the section adds another turn. */
const IDLE_TURN_MS = 26_000;

/**
 * "The drop": a pinned section with the most popular products on a 3D ring. The ring turns slowly
 * by itself and with the scroll. It waits while the pointer or keyboard is on a card.
 */
export function DropRing({
  products,
  loading,
  openProduct,
  onShop,
}: {
  products: Product[];
  loading: boolean;
  openProduct: (p: Product) => void;
  onShop: () => void;
}) {
  const track = useRef<HTMLElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const idle = useRef(0);
  const held = useRef(false);
  const progress = useScrollProgress(track);
  const still = useMediaQuery(REDUCED_MOTION);
  const reveal = useReveal();
  const cards = products.slice(0, RING_SIZE);
  const count = loading ? RING_SIZE : cards.length;

  useEffect(() => {
    const element = ring.current;
    const section = track.current;
    if (still || !element || !section) return;
    let frame = 0;
    let last = 0;
    const draw = (time: number) => {
      const elapsed = last ? Math.min(time - last, 100) : 0;
      last = time;
      if (!held.current) idle.current -= (elapsed / IDLE_TURN_MS) * 360;
      const p = progress.current;
      const spin = idle.current - p * 360;
      element.style.setProperty("--spin", `${spin.toFixed(2)}deg`);
      element.style.setProperty("--zoom", (1 + 0.1 * Math.sin(Math.PI * p)).toFixed(3));
      element.querySelectorAll<HTMLElement>(".ring-card").forEach((card, index) => {
        card.style.setProperty("--dim", ringCard(index, count, spin).opacity.toFixed(3));
      });
      frame = requestAnimationFrame(draw);
    };
    // The loop only runs while the section is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      last = 0;
      if (entry.isIntersecting) frame = requestAnimationFrame(draw);
    });
    visibility.observe(section);
    return () => {
      visibility.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [still, count, progress, track]);

  const hold = (value: boolean) => {
    held.current = value;
  };

  return (
    <section id="drop" className={`drop ${still ? "drop--static" : ""}`} ref={track}>
      <div className="drop-stage">
        <div className="drop-inner">
          <div className="drop-copy" ref={reveal}>
            <span className="mono-label">01 — THE DROP</span>
            <h2>
              New this week.
              <br />
              <em className="gradient">Straight from the brands.</em>
            </h2>
            <p>Fresh pairs and gear land every week. Spin the rack, pick your favourite.</p>
            <button className="pill pill-blue" onClick={onShop}>
              Shop the drop →
            </button>
          </div>
          <div className="ring-viewport" ref={reveal}>
            <div className="ring" ref={ring}>
              {loading
                ? Array.from({ length: RING_SIZE }, (_, index) => (
                    <div className="ring-slot" key={index} style={slot(index, RING_SIZE)}>
                      <Skeleton className="ring-card" />
                    </div>
                  ))
                : cards.map((product, index) => (
                    <div className="ring-slot" key={product.id} style={slot(index, count)}>
                      <button
                        className="ring-card"
                        aria-label={`${product.name}, ${shortMoney(product.price)}`}
                        onClick={() => openProduct(product)}
                        onPointerEnter={() => hold(true)}
                        onPointerLeave={() => hold(false)}
                        onFocus={(event) => {
                          if (!event.currentTarget.matches(":focus-visible")) return;
                          // Turn the focused card to the front and keep it there.
                          idle.current = ringSpinFor(index, count) + progress.current * 360;
                          hold(true);
                        }}
                        onBlur={() => hold(false)}
                      >
                        <img src={product.image} alt="" width="170" height="170" />
                        <span className="ring-brand">{brandOf(product.name) ?? product.category}</span>
                        <span className="ring-line">
                          <b>{product.name}</b>
                          <b className="ring-price">{shortMoney(product.price)}</b>
                        </span>
                      </button>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function slot(index: number, count: number): React.CSSProperties {
  return { "--angle": `${ringCard(index, count, 0).angle}deg` } as React.CSSProperties;
}
