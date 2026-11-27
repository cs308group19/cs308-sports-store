import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { CartView } from "../../types/models";
import type { SessionUser } from "../../auth/types";
import { Button } from "../../components/ui/Button";
import { ApiError } from "../../lib/api";
import { fetchCart } from "../../services/cartApi";
import { placeOrder } from "../../services/checkoutApi";
import { cartTotals } from "../../utils/cartTotals";
import { checkoutValidationError } from "../../utils/checkoutValidation";
import { money } from "../../utils/format";

export function Checkout({
  cart,
  customer,
  onSuccess,
  onCartRefresh,
  backToCart,
}: {
  cart: CartView;
  customer: SessionUser;
  onSuccess: (invoiceId: string) => void;
  onCartRefresh: (cart: CartView) => void;
  backToCart: () => void;
}) {
  const { subtotal, delivery, tax, total } = cartTotals(cart.items);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  useLayoutEffect(() => () => {
    pending.current = false;
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || cart.items.length === 0) return;

    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const input = {
      deliveryRecipient: field("deliveryRecipient"),
      deliveryAddress: field("deliveryAddress"),
      cardholderName: field("cardholderName"),
      cardNumber: field("cardNumber"),
      expiry: field("expiry"),
      cvv: field("cvv"),
    };
    const invalid = checkoutValidationError(input);
    setError(invalid);
    if (invalid) return;

    pending.current = true;
    setSubmitting(true);
    try {
      const { invoiceId } = await placeOrder(input, cart.items, total);
      if (pending.current) onSuccess(invoiceId);
    } catch (failure) {
      if (!pending.current) return;
      if (failure instanceof ApiError && failure.status === 409) {
        const refreshed = await fetchCart(true).catch(() => null);
        if (!pending.current) return;
        if (refreshed) onCartRefresh(refreshed);
        setError(refreshed
          ? `${failure.message} Review your updated cart before trying again.`
          : `${failure.message} Could not refresh your cart. Please try again.`);
      } else {
        setError(failure instanceof ApiError ? failure.message : "Could not place the order. Please try again.");
      }
    } finally {
      if (pending.current) setSubmitting(false);
      pending.current = false;
    }
  };

  return (
    <div className="page checkout-page">
      <form className="checkout-grid" onSubmit={submit} autoComplete="off" aria-busy={submitting}>
        <section className="checkout-form">
          <h1>
            Payment <span className="simulated">Simulated payment</span>
          </h1>
          <label>
            Name on card
            <input name="cardholderName" required maxLength={120} />
          </label>
          <label>
            Card number
            <input name="cardNumber" inputMode="numeric" required maxLength={23} placeholder="4242 4242 4242 4242" />
          </label>
          <div className="field-row">
            <label>
              Expiry
              <input name="expiry" required maxLength={5} placeholder="MM/YY" />
            </label>
            <label>
              CVV
              <input name="cvv" type="password" inputMode="numeric" required maxLength={4} />
            </label>
          </div>
          <h2>Delivery address</h2>
          <label>
            Recipient name
            <input name="deliveryRecipient" required maxLength={120} defaultValue={customer.name} />
          </label>
          <label>
            Full delivery address
            <textarea name="deliveryAddress" required maxLength={500} rows={3} defaultValue={customer.homeAddress ?? ""} />
          </label>
        </section>
        <aside className="summary">
          <h2>Your order</h2>
          {cart.items.map((line) => (
            <div className="summary-line" key={line.productId}>
              <img src={line.imageUrl ?? "/images/photo-unavailable.svg"} alt="" width="64" height="64" />
              <span>
                <b>{line.name}</b>
                <small>Qty {line.quantity}</small>
              </span>
              <b>{money(line.lineTotal)}</b>
            </div>
          ))}
          {cart.items.length === 0 && <p>Your cart is empty.</p>}
          <div className="summary-rows">
            <div>
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div>
              <span>Delivery</span>
              <b className={delivery === 0 ? "free" : ""}>{delivery === 0 ? "Free" : money(delivery)}</b>
            </div>
            <div>
              <span>Taxes</span>
              <b>{money(tax)}</b>
            </div>
          </div>
          <div className="total">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button type="submit" disabled={submitting || cart.items.length === 0}>
            {submitting ? "Placing order…" : `Place order · ${money(total)}`}
          </Button>
          <button className="text-button" type="button" disabled={submitting} onClick={backToCart}>
            Back to cart
          </button>
          <small className="secure-note">
            Test card 4242 4242 4242 4242 is approved, any other number is declined.
          </small>
        </aside>
      </form>
    </div>
  );
}
