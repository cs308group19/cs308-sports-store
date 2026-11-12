import type { Product } from "../../types/models";
import { ProductCard } from "../../components/ui/ProductCard";

export function Wishlist({
  products: items,
  openProduct,
  addToCart,
}: {
  products: Product[];
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <span className="eyebrow">Saved for later</span>
        <h1>My wishlist</h1>
        <p>You’ll be notified when saved items go on sale.</p>
      </div>
      <div className="product-grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} openProduct={openProduct} addToCart={addToCart} />
        ))}
      </div>
    </div>
  );
}
