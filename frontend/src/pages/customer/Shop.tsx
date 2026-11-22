import { useEffect, useMemo, useState } from "react";
import type { Product } from "../../types/models";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ProductCard } from "../../components/ui/ProductCard";
import { type CategorySummary, fetchCategories, fetchProducts } from "../../services/productApi";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/**
 * SCRUM-13. Lists products from GET /api/products, filtered by category on the server.
 * Search and sort still run in the browser until SCRUM-28 and SCRUM-29 move them to the API.
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
  const [sort, setSort] = useState("popularity");

  useEffect(() => setCategory(initialCategory), [initialCategory]);

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
    fetchProducts(category || undefined)
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
  }, [category, reloadKey]);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) =>
          sort === "low"
            ? a.price - b.price
            : sort === "high"
              ? b.price - a.price
              : b.popularity - a.popularity,
        ),
    [products, query, sort],
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or description..."
          />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
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
                {state.status === "loading" ? "Loading products..." : `${filtered.length} products`}
              </div>
              {state.status === "ready" && filtered.length === 0 && (
                <div className="empty">
                  <h2>No products found</h2>
                  <p>
                    {query
                      ? "Try a different search."
                      : "There are no products in this category yet."}
                  </p>
                </div>
              )}
              <div className="product-grid three">
                {filtered.map((product) => (
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
