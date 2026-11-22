import { useEffect, useMemo, useState } from "react";
import type { Product } from "../../types/models";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ProductCard } from "../../components/ui/ProductCard";
import {
  type CategorySummary,
  fetchCategories,
  fetchProducts,
  MAX_SEARCH_LENGTH,
} from "../../services/productApi";

/** Waits this long after the last key press before searching, so typing a word sends one request. */
const SEARCH_DELAY_MS = 300;

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/**
 * SCRUM-13 and 28. Lists products from GET /api/products. The category filter and the search by
 * name or description run on the server. Sort still runs in the browser until SCRUM-29 moves it
 * to the API.
 */
export function Shop({
  openProduct,
  addToCart,
  initialCategory = "",
}: {
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
  /** Category slug to open the shop on (from the home page). Empty means all categories. */
  initialCategory?: string;
}) {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popularity");

  useEffect(() => setCategory(initialCategory), [initialCategory]);

  // Search once the customer stops typing. Clearing the box shows every product right away.
  useEffect(() => {
    const words = query.trim();
    if (!words) {
      setSearch("");
      return;
    }
    const timer = window.setTimeout(() => setSearch(words), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        // The product list shows the error; the sidebar just stays on "All".
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchProducts({ category, search })
      .then((list) => {
        if (cancelled) return;
        setProducts(list);
        setState({ status: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProducts([]);
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Products could not be loaded.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [category, search, reloadKey]);

  const sorted = useMemo(
    () =>
      [...products].sort((a, b) =>
        sort === "low"
          ? a.price - b.price
          : sort === "high"
            ? b.price - a.price
            : b.popularity - a.popularity,
      ),
    [products, sort],
  );

  const totalCount = categories.reduce((sum, item) => sum + item.productCount, 0);
  const activeName = categories.find((item) => item.slug === category)?.name;

  return (
    <div className="page shop-page">
      <div className="page-heading">
        <span className="eyebrow">Performance collection</span>
        <h1>{activeName ?? "Shop all gear"}</h1>
        <p>Purpose-built products for training, competition, and everything between.</p>
      </div>
      <div className="shop-tools">
        <label className="search-box">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            maxLength={MAX_SEARCH_LENGTH}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or description..."
            aria-label="Search products by name or description"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort products"
        >
          <option value="popularity">Most popular</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
      </div>
      <div className="shop-layout">
        <aside>
          <b>Categories</b>
          <button className={category === "" ? "active" : ""} onClick={() => setCategory("")}>
            <span>All</span>
            {categories.length > 0 && <small>{totalCount}</small>}
          </button>
          {categories.map((item) => (
            <button
              className={item.slug === category ? "active" : ""}
              onClick={() => setCategory(item.slug)}
              key={item.slug}
            >
              <span>{item.name}</span>
              <small>{item.productCount}</small>
            </button>
          ))}
        </aside>
        <div aria-busy={state.status === "loading"}>
          {state.status === "error" ? (
            <div className="empty">
              <h2>Products could not be loaded</h2>
              <p>{state.message}</p>
              <Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>
            </div>
          ) : (
            <>
              <div className="result-count">
                {state.status === "loading" ? "Loading products..." : `${products.length} products`}
              </div>
              {state.status === "ready" && products.length === 0 && (
                <div className="empty">
                  <h2>No products found</h2>
                  <p>
                    {search
                      ? "Try a different search."
                      : "There are no products in this category yet."}
                  </p>
                </div>
              )}
              <div className="product-grid three">
                {sorted.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    openProduct={openProduct}
                    addToCart={addToCart}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
