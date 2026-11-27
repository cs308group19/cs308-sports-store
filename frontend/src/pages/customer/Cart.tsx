import type { CartView, CartViewItem, Product } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { cartLineImage } from "../../services/productPhotos";
import { cartTotals } from "../../utils/cartTotals";
import { money } from "../../utils/format";
import { productStub } from "../../utils/productStub";

export function Cart({
  cart,
  changeQuantity,
  removeItem,
  navigate,
  openProduct,
}: {
  cart: CartView;
  changeQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  navigate: (v: View) => void;
  openProduct: (p: Product) => void;
}) {
  // The same amounts as the checkout page, worked out in cents (utils/cartTotals.ts).
  const { subtotal, delivery, tax, total } = cartTotals(cart.items);
  const open = (line: CartViewItem) =>
    openProduct(
      productStub({
        id: line.productId,
        name: line.name,
        price: line.price,
        image: cartLineImage(line),
        model: line.model,
      }),
    );
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Your selection</span>
        <h1>Shopping cart</h1>
      </div>
      {cart.items.length === 0 ? (
        <EmptyState
          icon="bag"
          title="Your cart is empty"
          text="Pick your game and add the gear you need."
          action="Start shopping"
          onAction={() => navigate("shop")}
        />
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.items.map((line) => (
              <article className="cart-line" key={line.productId}>
                <button className="cart-photo" aria-label={`View ${line.name}`} onClick={() => open(line)}>
                  <img src={cartLineImage(line)} alt="" width="110" height="110" loading="lazy" />
                </button>
                <div>
                  <h3>
                    <button onClick={() => open(line)}>{line.name}</button>
                  </h3>
                  <b>{money(line.price)}</b>
                  {line.quantity >= line.stock && <small>Only {line.stock} left in stock</small>}
                </div>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    disabled={line.quantity <= 1}
                    onClick={() => changeQuantity(line.productId, line.quantity - 1)}
                  >
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    aria-label="Increase quantity"
                    disabled={line.quantity >= line.stock}
                    onClick={() => changeQuantity(line.productId, line.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <button className="remove" onClick={() => removeItem(line.productId)}>
                  Remove
                </button>
              </article>
            ))}
          </div>
          <aside className="summary">
            <h2>Order summary</h2>
            <div>
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div>
              <span>Delivery</span>
              <b>{delivery === 0 ? "Free" : money(delivery)}</b>
            </div>
            <div>
              <span>Taxes</span>
              <b>{money(tax)}</b>
            </div>
            <div className="total">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
            <Button disabled={!cart.items.length} onClick={() => navigate("checkout")}>
              Continue to checkout
            </Button>
            <button className="text-button" onClick={() => navigate("shop")}>
              Keep shopping
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
