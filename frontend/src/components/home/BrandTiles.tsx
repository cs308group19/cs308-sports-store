import type { Product } from "../../types/models";
import { useReveal } from "../../hooks/useReveal";
import { brandSummaries } from "../../utils/brands";
import { SkeletonCards } from "../ui/Skeleton";
import { SectionTitle } from "./SectionTitle";

const GLOWS = ["rgba(2,151,222,.45)", "rgba(252,115,77,.4)", "rgba(216,57,149,.4)", "rgba(22,130,93,.45)"];

export function BrandTiles({
  products,
  loading,
  openBrand,
  openProduct,
}: {
  products: Product[];
  loading: boolean;
  openBrand: (brand: string) => void;
  openProduct: (p: Product) => void;
}) {
  const reveal = useReveal();
  const brands = brandSummaries(products);
  if (!loading && brands.length === 0) return null;

  return (
    <section id="brands" className="home-section brands">
      <SectionTitle label="02 — THE BRANDS" title="All the names you know." reveal={reveal} />
      <div className="brand-grid">
        {loading && <SkeletonCards count={4} label="Loading brands" />}
        {brands.map((brand, index) => (
          <div key={brand.name} ref={reveal} style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
            <article className="brand-tile">
              <span
                className="brand-glow"
                style={{ background: `radial-gradient(circle, ${GLOWS[index % GLOWS.length]}, transparent 65%)` }}
              />
              <button className="brand-open" onClick={() => openBrand(brand.name)}>
                <b>{brand.name}</b>
                <span>
                  {brand.products.length} product{brand.products.length === 1 ? "" : "s"}
                </span>
              </button>
              <span className="brand-thumbs">
                {brand.products.slice(0, 2).map((product) => (
                  <button key={product.id} aria-label={`View ${product.name}`} onClick={() => openProduct(product)}>
                    <img src={product.image} alt="" width="62" height="62" loading="lazy" />
                  </button>
                ))}
              </span>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
