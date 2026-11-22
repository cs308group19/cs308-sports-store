import type { CartView } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { cartTotals } from "../../utils/cartTotals";
import { money } from "../../utils/format";

export function Cart({
  cart,
  changeQuantity,
  removeItem,
  navigate,
}: {
  cart: CartView;
  changeQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  navigate: (v: View) => void;
}) {
  // The same amounts as the checkout page, worked out in cents (utils/cartTotals.ts).
  const { subtotal, delivery, tax, total } = cartTotals(cart.items);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Your selection</span>
        <h1>Shopping cart</h1>
      </div>
      {cart.items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.items.map((line) => (
              <article className="cart-line" key={line.productId}>
                {line.imageUrl && <img src={line.imageUrl} alt="" />}
                <div>
                  <h3>{line.name}</h3>
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
