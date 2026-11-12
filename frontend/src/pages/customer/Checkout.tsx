import { type FormEvent } from "react";
import type { CartLine } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { money } from "../../utils/format";

export function Checkout({ cart, navigate }: { cart: CartLine[]; navigate: (v: View) => void }) {
  const total = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0) * 1.08;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate("invoice");
  };
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Secure checkout</span>
        <h1>Delivery & payment</h1>
      </div>
      <form className="checkout-grid" onSubmit={submit}>
        <div className="checkout-form">
          <h2>Delivery address</h2>
          <div className="field-row">
            <label>
              First name
              <input required defaultValue="Jamie" />
            </label>
            <label>
              Last name
              <input required defaultValue="Taylor" />
            </label>
          </div>
          <label>
            Street address
            <input required placeholder="123 Fast Lane" />
          </label>
          <div className="field-row">
            <label>
              City
              <input required placeholder="Istanbul" />
            </label>
            <label>
              Postal code
              <input required placeholder="34000" />
            </label>
          </div>
          <h2>
            Card details <span className="simulated">Simulated payment</span>
          </h2>
          <label>
            Card number
            <input required defaultValue="4242 4242 4242 4242" />
          </label>
          <div className="field-row">
            <label>
              Expiry
              <input required defaultValue="12/28" />
            </label>
            <label>
              CVC
              <input required defaultValue="123" />
            </label>
          </div>
        </div>
        <aside className="summary">
          <h2>Your order</h2>
          {cart.map((l) => (
            <div key={l.product.id}>
              <span>
                {l.product.name} × {l.quantity}
              </span>
              <b>{money(l.product.price * l.quantity)}</b>
            </div>
          ))}
          <div className="total">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
          <Button type="submit">Place order</Button>
          <small className="secure-note">
            Secure, encrypted checkout. No real payment is processed.
          </small>
        </aside>
      </form>
    </div>
  );
}
