import { useEffect, useState } from "react";
import type { Product } from "../../types/models";
import {
  type CategorySummary,
  fetchCategories,
  fetchProducts,
} from "../../services/productApi";
import { BrandTiles } from "../../components/home/BrandTiles";
import { CategoryTiles } from "../../components/home/CategoryTiles";
import { DropRing } from "../../components/home/DropRing";
import { GearCards } from "../../components/home/GearCards";
import { JournalSection } from "../../components/home/JournalSection";
import { RallyIntro } from "../../components/home/RallyIntro";
import { Trending } from "../../components/home/Trending";
import type { HomeSection } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { scrollToSection } from "../../utils/scrollToSection";

/** SCRUM-13. Categories and product rows come from the API (most popular first). */
export function Home({
  openShop,
  openCategory,
  openBrand,
  openProduct,
  addToCart,
  section = null,
  onSectionShown,
  refreshKey = 0,
}: {
  openShop: () => void;
  openCategory: (slug: string) => void;
  openBrand: (brand: string) => void;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
  /** A section to scroll to as soon as the page has its content. */
  section?: HomeSection | null;
  onSectionShown?: () => void;
  refreshKey?: number;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([productList, categoryList]) => {
        if (cancelled) return;
        setProducts(productList);
        setCategories(categoryList);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, attempt]);

  useEffect(() => {
    if (!section || status === "loading") return;
    const frame = requestAnimationFrame(() => {
      scrollToSection(section);
      onSectionShown?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [section, status, onSectionShown]);

  const loading = status === "loading";

  return (
    <div className="home">
      <RallyIntro drop={products[0]} openProduct={openProduct} />
      {status === "failed" ? (
        <div className="empty" role="alert">
          <h2>Products could not be loaded</h2>
          <p>Please try again in a moment.</p>
          <Button
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <DropRing products={products} loading={loading} openProduct={openProduct} onShop={openShop} />
          <BrandTiles products={products} loading={loading} openBrand={openBrand} openProduct={openProduct} />
          <CategoryTiles categories={categories} products={products} loading={loading} openCategory={openCategory} />
          <Trending products={products} loading={loading} openProduct={openProduct} addToCart={addToCart} />
        </>
      )}
      <GearCards />
      <JournalSection openCategory={openCategory} />
      <section id="sale" className="sale-band">
        <div className="sale-glow" />
        <h2>
          Up to 30% off.
          <br />
          <em>This week only.</em>
        </h2>
        <button className="pill pill-white" onClick={openShop}>
          Explore the sale
        </button>
      </section>
    </div>
  );
}
