import { useEffect, useState } from "react";
import type { Product } from "../../types/models";
import {
  type CategorySummary,
  fetchCategories,
  fetchProducts,
} from "../../services/productApi";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ProductCard } from "../../components/ui/ProductCard";
import { SectionHead } from "../../components/ui/SectionHead";

/** SCRUM-13. Categories and product rows come from the API (most popular first). */
export function Home({
  navigate,
  openCategory,
  openProduct,
  addToCart,
  refreshKey = 0,
}: {
  navigate: (v: View) => void;
  openCategory: (slug: string) => void;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
  refreshKey?: number;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([productList, categoryList]) => {
        if (cancelled) return;
        setProducts(productList);
        setCategories(categoryList);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const onSale = products.filter((p) => p.oldPrice);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow light">Built for your next move</span>
          <h1>
            Gear up.
            <br />
            <em>Go further.</em>
          </h1>
          <p>Performance essentials for every athlete, every workout, and every goal.</p>
          <Button onClick={() => navigate("shop")}>
            Shop new arrivals <Icon name="arrow" size={18} />
          </Button>
        </div>
        <div className="hero-image">
          <img src="/images/running-track.webp" alt="Sprinter accelerating on an outdoor track" />
          <div className="hero-stat">
            <b>4.9/5</b>
            <span>Trusted by 12k+ athletes</span>
          </div>
        </div>
      </section>
      <section className="section">
        <SectionHead
          eyebrow="Find your sport"
          title="Shop by category"
          action="View all"
          onAction={() => navigate("shop")}
        />
        <div className="category-grid">
          {categories.map((category, i) => (
            <button
              className={`category-card cat-${i % 6}`}
              key={category.slug}
              onClick={() => openCategory(category.slug)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{category.name}</strong>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>
      <section className="section shade">
        <SectionHead eyebrow="Community favorites" title="Popular right now" />
        {failed && (
          <p className="empty">Products could not be loaded. Please try again in a moment.</p>
        )}
        <div className="product-grid">
          {products.slice(0, 4).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              openProduct={openProduct}
              addToCart={addToCart}
            />
          ))}
        </div>
      </section>
      <section className="promo">
        <div>
          <span className="eyebrow light">This week only</span>
          <h2>
            Up to 30% off
            <br />
            training essentials
          </h2>
          <p>Refresh your routine without slowing down.</p>
          <Button onClick={() => navigate("shop")}>Explore the sale</Button>
        </div>
        <div className="promo-number">
          30<span>%</span>
        </div>
      </section>
      <section className="section">
        <SectionHead
          eyebrow="Limited time"
          title="Price drops"
          action="Shop sale"
          onAction={() => navigate("shop")}
        />
        <div className="product-grid">
          {onSale.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              openProduct={openProduct}
              addToCart={addToCart}
            />
          ))}
        </div>
      </section>
    </>
  );
}
