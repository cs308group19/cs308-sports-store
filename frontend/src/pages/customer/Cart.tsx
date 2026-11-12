import type { CartLine } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { money } from "../../utils/format";

export function Cart({
  cart,
  setCart,
  navigate,
}: {
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  navigate: (v: View) => void;
}) {
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const update = (id: number, delta: number) =>
    setCart(
      cart.map((line) =>
        line.product.id === id ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line,
      ),
    );
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Your selection</span>
        <h1>Shopping cart</h1>
      </div>
      <div className="cart-layout">
        <div className="cart-list">
          {cart.map((line) => (
            <article className="cart-line" key={line.product.id}>
              <img src={line.product.image} alt="" />
              <div>
                <small>{line.product.category}</small>
                <h3>{line.product.name}</h3>
                <b>{money(line.product.price)}</b>
              </div>
              <div className="quantity">
                <button onClick={() => update(line.product.id, -1)}>−</button>
                <span>{line.quantity}</span>
                <button onClick={() => update(line.product.id, 1)}>+</button>
              </div>
              <button
                className="remove"
                onClick={() => setCart(cart.filter((c) => c.product.id !== line.product.id))}
              >
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
            <b>{subtotal >= 75 ? "Free" : "$8.00"}</b>
          </div>
          <div>
            <span>Taxes</span>
            <b>{money(subtotal * 0.08)}</b>
          </div>
          <div className="total">
            <span>Total</span>
            <b>{money(subtotal + subtotal * 0.08 + (subtotal >= 75 ? 0 : 8))}</b>
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
