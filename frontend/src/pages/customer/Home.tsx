import type { Product } from "../../types/models";
import { products, categories } from "../../services/mockStore";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ProductCard } from "../../components/ui/ProductCard";
import { SectionHead } from "../../components/ui/SectionHead";

export function Home({
  navigate,
  openProduct,
  addToCart,
}: {
  navigate: (v: View) => void;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
}) {
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
          <img src={products[0].image} alt="Performance sneakers in a dark studio" />
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
              className={`category-card cat-${i}`}
              key={category}
              onClick={() => navigate("shop")}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{category}</strong>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      </section>
      <section className="section shade">
        <SectionHead eyebrow="Community favorites" title="Popular right now" />
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
          {products
            .filter((p) => p.oldPrice)
            .map((product) => (
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
