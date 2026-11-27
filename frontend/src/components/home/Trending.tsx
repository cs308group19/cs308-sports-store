import type { Product } from "../../types/models";
import { useReveal } from "../../hooks/useReveal";
import { ProductCard } from "../ui/ProductCard";
import { SkeletonCards } from "../ui/Skeleton";
import { SectionTitle } from "./SectionTitle";

const SHOWN = 8;

export function Trending({
  products,
  loading,
  openProduct,
  addToCart,
}: {
  products: Product[];
  loading: boolean;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
}) {
  const reveal = useReveal();

  return (
    <section id="trending" className="trending">
      <div className="home-section">
        <SectionTitle label="04 — TRENDING" title="Everyone's wearing these." reveal={reveal} />
      </div>
      <div className="trending-row">
        {loading && <SkeletonCards count={5} label="Loading products" />}
        {products.slice(0, SHOWN).map((product, index) => (
          <div key={product.id} ref={reveal} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
            <ProductCard product={product} openProduct={openProduct} addToCart={addToCart} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
