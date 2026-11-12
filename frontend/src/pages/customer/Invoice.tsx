import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";

export function Invoice({
  notify,
  navigate,
}: {
  notify: (s: string) => void;
  navigate: (v: View) => void;
}) {
  return (
    <div className="page invoice-page">
      <div className="success-mark">
        <Icon name="check" size={34} />
      </div>
      <span className="eyebrow">Order confirmed</span>
      <h1>Thanks, Jamie!</h1>
      <p>Your order is confirmed. A copy of this invoice has been emailed to you.</p>
      <article className="invoice">
        <div className="invoice-head">
          <div className="brand">
            <span className="brand-mark">R</span>
            <span className="brand-lockup">
              <b>RALLY</b>
              <small>Play it your way</small>
            </span>
          </div>
          <div>
            <small>INVOICE</small>
            <b>#RLY-81142</b>
          </div>
        </div>
        <div className="invoice-meta">
          <div>
            <small>BILLED TO</small>
            <b>Jamie Taylor</b>
            <span>123 Fast Lane, Istanbul</span>
          </div>
          <div>
            <small>DATE</small>
            <b>May 24, 2025</b>
          </div>
        </div>
        <div className="invoice-row">
          <span>Velocity Knit × 1</span>
          <b>$99.00</b>
        </div>
        <div className="invoice-row">
          <span>Taxes</span>
          <b>$7.92</b>
        </div>
        <div className="invoice-row invoice-total">
          <span>Total paid</span>
          <b>$106.92</b>
        </div>
      </article>
      <div className="center-actions">
        <Button onClick={() => notify("Invoice PDF downloaded")}>
          <Icon name="download" size={18} /> Download PDF
        </Button>
        <Button variant="outline" onClick={() => navigate("orders")}>
          View my orders
        </Button>
      </div>
    </div>
  );
}
