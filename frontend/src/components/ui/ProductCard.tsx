import type { Product } from "../../types/models";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Stars } from "./Stars";
import { money } from "../../utils/format";

export function ProductCard({
  product,
  openProduct,
  addToCart,
}: {
  product: Product;
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
}) {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <article className="product-card">
      <button className="product-image" onClick={() => openProduct(product)}>
        <img src={product.image} alt={product.name} />
        {discount > 0 && <span className="discount">-{discount}%</span>}
        <span className="heart">
          <Icon name="heart" size={18} />
        </span>
      </button>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <button className="product-title" onClick={() => openProduct(product)}>
          {product.name}
        </button>
        <Stars rating={product.rating} />
        <div className="price-row">
          <div>
            <b>{money(product.price)}</b>
            {product.oldPrice && <s>{money(product.oldPrice)}</s>}
          </div>
          <span className={product.stock ? "in-stock" : "out-stock"}>
            {product.stock ? `${product.stock} in stock` : "Out of stock"}
          </span>
        </div>
        <Button variant="dark" disabled={!product.stock} onClick={() => addToCart(product)}>
          {product.stock ? "Add to cart" : "Unavailable"}
        </Button>
      </div>
    </article>
  );
}
