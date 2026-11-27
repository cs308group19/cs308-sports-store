import type { Product } from "../../types/models";
import { EmptyState } from "../../components/ui/EmptyState";
import { ProductCard } from "../../components/ui/ProductCard";

export function Wishlist({
  products: items,
  openProduct,
  addToCart,
  onShop,
}: {
  products: Product[];
  openProduct: (p: Product) => void;
  addToCart: (p: Product) => void;
  onShop: () => void;
}) {
  return (
    <div className="page">
      <div className="page-heading">
        <span className="eyebrow">Saved for later</span>
        <h1>My wishlist</h1>
        <p>You’ll be notified when saved items go on sale.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Your wishlist is empty"
          text="Tap the heart on a product page to keep it here."
          action="Start shopping"
          onAction={onShop}
        />
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} openProduct={openProduct} addToCart={addToCart} />
          ))}
        </div>
      )}
    </div>
  );
}
