import type { Product } from "../../types/models";
import type { CategorySummary } from "../../services/productApi";
import { useReveal } from "../../hooks/useReveal";
import { SkeletonCards } from "../ui/Skeleton";
import { SectionTitle } from "./SectionTitle";

export function CategoryTiles({
  categories,
  products,
  loading,
  openCategory,
}: {
  categories: CategorySummary[];
  products: Product[];
  loading: boolean;
  openCategory: (slug: string) => void;
}) {
  const reveal = useReveal();

  return (
    <section id="sports" className="home-section sports">
      <SectionTitle label="03 — FIND YOUR SPORT" title="Pick your game." hot reveal={reveal} />
      <div className="category-grid">
        {loading && <SkeletonCards count={6} label="Loading categories" />}
        {categories.map((category, index) => (
          <div key={category.slug} ref={reveal} style={{ "--delay": `${index * 110}ms` } as React.CSSProperties}>
            <button className="category-tile" onClick={() => openCategory(category.slug)}>
              <img
                src={`/images/category-${category.slug}.webp`}
                alt=""
                width="1600"
                height="1067"
                loading="lazy"
                onError={(event) => {
                  // A category without its own photo shows its first product instead.
                  const fallback = products.find((p) => p.category === category.name)?.image;
                  const image = event.currentTarget;
                  if (fallback && !image.dataset.fallback) {
                    image.dataset.fallback = "true";
                    image.src = fallback;
                  }
                }}
              />
              <span className="category-shade" />
              <span className="category-line">
                <strong>{category.name}</strong>
                <span className="category-shop">Shop {category.name}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
