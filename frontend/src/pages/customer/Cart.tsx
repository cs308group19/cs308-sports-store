import { useState } from "react";
import type { CartLine } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { cartTotals } from "../../utils/cartTotals";
import { money } from "../../utils/format";

/**
 * SCRUM-16. Every change goes to the cart API, which checks the stock; the page then shows the
 * cart the server sent back.
 */
export function Cart({
  cart,
  changeQuantity,
  remove,
  navigate,
}: {
  cart: CartLine[];
  changeQuantity: (productId: number, quantity: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  navigate: (v: View) => void;
}) {
  // The product whose change is on its way, so a double click cannot send it twice.
  const [busy, setBusy] = useState<number | null>(null);
  const run = async (productId: number, action: () => Promise<void>) => {
    setBusy(productId);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  const { subtotal, delivery, tax, total } = cartTotals(cart);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Your selection</span>
        <h1>Shopping cart</h1>
      </div>
      <div className="cart-layout">
        <div className="cart-list">
          {cart.length === 0 && (
            <div className="empty">
              <h2>Your cart is empty</h2>
              <p>Add products from the shop and they will wait for you here.</p>
            </div>
          )}
          {cart.map((line) => {
            const id = line.product.id;
            const locked = busy === id;
            return (
              <article className="cart-line" key={id} aria-busy={locked}>
                <img src={line.product.image} alt="" />
                <div>
                  <small>{line.product.category}</small>
                  <h3>{line.product.name}</h3>
                  <b>{money(line.product.price)}</b>
                </div>
                <div className="quantity">
                  <button
                    aria-label={`One less ${line.product.name}`}
                    disabled={locked || line.quantity <= 1}
                    onClick={() => run(id, () => changeQuantity(id, line.quantity - 1))}
                  >
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    aria-label={`One more ${line.product.name}`}
                    disabled={locked || line.quantity >= line.product.stock}
                    onClick={() => run(id, () => changeQuantity(id, line.quantity + 1))}
                  >
                    +
                  </button>
                </div>
                <button
                  className="remove"
                  disabled={locked}
                  onClick={() => run(id, () => remove(id))}
                >
                  Remove
                </button>
              </article>
            );
          })}
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
          <Button disabled={!cart.length} onClick={() => navigate("checkout")}>
            Continue to checkout
          </Button>
          <button className="text-button" onClick={() => navigate("shop")}>
            Keep shopping
          </button>
        </aside>
      </div>
    </div>
  );
}
