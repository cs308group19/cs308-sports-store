import { useMemo, useState } from "react";
import type { Product } from "../../types/models";
import { products, categories } from "../../services/mockStore";
import { Icon } from "../../components/ui/Icon";
import { ProductCard } from "../../components/ui/ProductCard";

export function Shop({
  openProduct,
  addToCart,
}: {
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
}) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("popularity");
  const filtered = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (category === "All" || p.category === category) &&
            `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "low"
            ? a.price - b.price
            : sort === "high"
              ? b.price - a.price
              : b.popularity - a.popularity,
        ),
    [category, query, sort],
  );
  return (
    <div className="page shop-page">
      <div className="page-heading">
        <span className="eyebrow">Performance collection</span>
        <h1>Shop all gear</h1>
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
          {["All", ...categories].map((item) => (
            <button
              className={item === category ? "active" : ""}
              onClick={() => setCategory(item)}
              key={item}
            >
              <span>{item}</span>
              <small>
                {item === "All"
                  ? products.length
                  : products.filter((p) => p.category === item).length}
              </small>
            </button>
          ))}
        </aside>
        <div>
          <div className="result-count">{filtered.length} products</div>
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
        </div>
      </div>
    </div>
  );
}
