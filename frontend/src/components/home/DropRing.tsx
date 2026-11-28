import { useCallback } from "react";
import type { Product } from "../../types/models";
import { REDUCED_MOTION, useMediaQuery } from "../../hooks/useMediaQuery";
import { useReveal } from "../../hooks/useReveal";
import { useRingSpin } from "../../hooks/useRingSpin";
import { brandOf } from "../../utils/brands";
import { shortMoney } from "../../utils/format";
import { ringCard } from "../../utils/motion";
import { Skeleton } from "../ui/Skeleton";

export const RING_SIZE = 6;

/**
 * "The drop": the most popular products on a 3D ring. The ring turns by itself and can be spun
 * sideways; the section scrolls past like any other.
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
  const still = useMediaQuery(REDUCED_MOTION);
  const reveal = useReveal();
  const cards = products.slice(0, RING_SIZE);
  const count = loading ? RING_SIZE : cards.length;
  const { area, ring, handlers } = useRingSpin(still, count);
  const attachArea = useCallback(
    (element: HTMLDivElement | null) => {
      area.current = element;
      return reveal(element);
    },
    [area, reveal],
  );

  return (
    <section id="drop" tabIndex={-1} className="drop">
      <div className="drop-stage">
        <div className="drop-inner">
          <div className="drop-copy" ref={reveal}>
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
          <div
            className="ring-viewport"
            ref={attachArea}
            tabIndex={0}
            role="group"
            aria-label="New products. Use the left and right arrow keys to turn the ring."
            {...handlers}
          >
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
                      >
                        <img src={product.image} alt="" width="170" height="170" draggable={false} />
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
