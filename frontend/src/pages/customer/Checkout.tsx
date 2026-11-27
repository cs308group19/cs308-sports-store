import { useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { CartView } from "../../types/models";
import type { SessionUser } from "../../auth/types";
import { PaymentCard } from "../../components/checkout/PaymentCard";
import { Button } from "../../components/ui/Button";
import { ApiError } from "../../lib/api";
import { fetchCart } from "../../services/cartApi";
import { placeOrder } from "../../services/checkoutApi";
import { cardDigits, formatCardNumber, formatExpiry } from "../../utils/cardFormat";
import { cartTotals } from "../../utils/cartTotals";
import { checkoutValidationError } from "../../utils/checkoutValidation";
import { money } from "../../utils/format";

/** How long the "Paid" check mark shows before the invoice opens. */
const PAID_PAUSE_MS = 900;

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
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [showBack, setShowBack] = useState(false);
  const pending = useRef(false);
  /** Set once the order is saved, until the invoice has been opened. */
  const unfinished = useRef(false);
  const refreshCart = useRef(onCartRefresh);
  refreshCart.current = onCartRefresh;

  useLayoutEffect(() => () => {
    pending.current = false;
    // Left during the check mark: the order is placed, so the cart is empty.
    if (unfinished.current) refreshCart.current({ items: [], total: 0 });
  }, []);

  /** Reformats a field as it is typed and keeps the cursor behind the same digit. */
  const format = (event: ChangeEvent<HTMLInputElement>, field: "number" | "expiry", formatter: (v: string) => string) => {
    const input = event.currentTarget;
    const before = input.value.slice(0, input.selectionStart ?? input.value.length);
    const atEnd = before.length === input.value.length;
    const value = formatter(input.value);
    input.value = value;
    if (!atEnd) {
      let digits = before.replace(/\D/g, "").length;
      let position = 0;
      while (position < value.length && digits > 0) if (/\d/.test(value[position++])) digits -= 1;
      input.setSelectionRange(position, position);
    }
    setCard((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || cart.items.length === 0) return;

    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const input = {
      deliveryRecipient: field("deliveryRecipient"),
      deliveryAddress: field("deliveryAddress"),
      cardholderName: field("cardholderName"),
      // The field shows groups of four; the API receives digits only.
      cardNumber: cardDigits(field("cardNumber")),
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
      if (!pending.current) return;
      unfinished.current = true;
      setPaid(true);
      await new Promise((resolve) => window.setTimeout(resolve, PAID_PAUSE_MS));
      if (!pending.current) return;
      unfinished.current = false;
      onSuccess(invoiceId);
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
          <PaymentCard
            number={card.number}
            name={card.name}
            expiry={card.expiry}
            cvvLength={card.cvv.length}
            flipped={showBack}
          />
          <label>
            Name on card
            <input
              name="cardholderName"
              autoComplete="cc-name"
              required
              maxLength={120}
              value={card.name}
              onChange={(e) => {
                const name = e.currentTarget.value;
                setCard((current) => ({ ...current, name }));
              }}
            />
          </label>
          <label>
            Card number
            <input
              name="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              required
              placeholder="4242 4242 4242 4242"
              value={card.number}
              onChange={(e) => format(e, "number", formatCardNumber)}
            />
          </label>
          <div className="field-row">
            <label>
              Expiry
              <input
                name="expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                required
                placeholder="MM/YY"
                value={card.expiry}
                onChange={(e) => format(e, "expiry", formatExpiry)}
              />
            </label>
            <label>
              CVV
              <input
                name="cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                required
                maxLength={4}
                placeholder="123"
                value={card.cvv}
                onChange={(e) => {
                  const cvv = e.currentTarget.value.replace(/\D/g, "");
                  setCard((current) => ({ ...current, cvv }));
                }}
                onFocus={() => setShowBack(true)}
                onBlur={() => setShowBack(false)}
              />
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
          <Button
            type="submit"
            className={`place-order ${paid ? "paid" : ""}`}
            disabled={submitting || cart.items.length === 0}
          >
            {paid ? (
              <>
                <svg className="check-draw" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Paid · opening invoice
              </>
            ) : submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Processing…
              </>
            ) : (
              `Place order · ${money(total)}`
            )}
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
