import type { Product } from "../../types/models";
import { Stars } from "./Stars";
import { brandOf } from "../../utils/brands";
import { shortMoney } from "../../utils/format";

export function ProductCard({
  product,
  openProduct,
  addToCart,
  compact = false,
}: {
  product: Product;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
  /** The shorter card of the home page row: no rating or stock count. */
  compact?: boolean;
}) {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <article className="product-card">
      <button className="product-image" onClick={() => openProduct(product)}>
        <img src={product.image} alt={product.name} width="800" height="800" loading="lazy" />
        {discount > 0 && <span className="discount">-{discount}%</span>}
      </button>
      <div className="product-info">
        <span className="product-brand">{brandOf(product.name) ?? product.category}</span>
        <button className="product-title" onClick={() => openProduct(product)}>
          {product.name}
        </button>
        {!compact && (
          <div className="product-meta">
            <Stars rating={product.rating} />
            <span className={product.stock ? "in-stock" : "out-stock"}>
              {product.stock ? `${product.stock} in stock` : "Out of stock"}
            </span>
          </div>
        )}
        <div className="price-row">
          <div>
            <b>{shortMoney(product.price)}</b>
            {product.oldPrice && <s>{shortMoney(product.oldPrice)}</s>}
          </div>
          {compact && !product.stock && <span className="out-stock">Sold out</span>}
          <button
            className="add-button"
            aria-label={product.stock ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
            disabled={!product.stock}
            onClick={() => addToCart(product)}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}
