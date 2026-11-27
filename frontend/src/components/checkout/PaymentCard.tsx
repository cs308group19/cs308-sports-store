import { cardBrand, maskedCardNumber } from "../../utils/cardFormat";

/**
 * A picture of the card being typed. It turns over while the security code is entered, and never
 * shows the code itself. Decorative: the form fields carry the same information.
 */
export function PaymentCard({
  number,
  name,
  expiry,
  cvvLength,
  flipped,
}: {
  number: string;
  name: string;
  expiry: string;
  cvvLength: number;
  flipped: boolean;
}) {
  const brand = cardBrand(number);
  return (
    <div className="pay-card" aria-hidden="true">
      <div className={`pay-card-inner ${flipped ? "flipped" : ""}`}>
        <div className="pay-card-front">
          <div className="pay-card-top">
            <span className="pay-card-chip" />
            <b className="pay-card-brand">{brand === "Card" ? "RALLY PAY" : brand.toUpperCase()}</b>
          </div>
          <span className="pay-card-number">{maskedCardNumber(number)}</span>
          <div className="pay-card-bottom">
            <span>
              <small>Card holder</small>
              <b>{name.trim() || "Your name"}</b>
            </span>
            <span>
              <small>Expires</small>
              <b>{expiry || "MM/YY"}</b>
            </span>
          </div>
        </div>
        <div className="pay-card-back">
          <span className="pay-card-stripe" />
          <span className="pay-card-signature">
            <i />
            <b>{"•".repeat(cvvLength || 3)}</b>
          </span>
          <small>Simulated card · no real payment is made</small>
        </div>
      </div>
    </div>
  );
}
