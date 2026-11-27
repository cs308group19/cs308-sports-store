import { useEffect, useState } from "react";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Logo } from "../../components/ui/Logo";
import {
  fetchInvoice,
  fetchInvoicePdf,
  invoiceErrorMessage,
  isInvoiceNotFound,
} from "../../services/invoiceApi";
import type { InvoiceView } from "../../types/invoice";
import { saveBlob } from "../../utils/download";
import {
  addressLines,
  firstName,
  formatAmount,
  formatDiscount,
  formatInvoiceDate,
} from "../../utils/invoiceFormat";

type State =
  | { kind: "loading" }
  | { kind: "ready"; invoice: InvoiceView }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export function Invoice({
  invoiceId,
  notify,
  navigate,
}: {
  /** From the checkout response ({ orderId, orderNumber, invoiceId }). */
  invoiceId: string | null;
  notify: (message: string) => void;
  navigate: (v: View) => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (invoiceId === null) {
      setState({ kind: "not-found" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    fetchInvoice(invoiceId).then(
      (invoice) => {
        if (!cancelled) setState({ kind: "ready", invoice });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState(
          isInvoiceNotFound(error)
            ? { kind: "not-found" }
            : { kind: "error", message: invoiceErrorMessage(error) },
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [invoiceId, attempt]);

  if (state.kind === "loading")
    return (
      <div className="page invoice-page" aria-busy="true">
        <span className="eyebrow">Invoice</span>
        <h1>Loading your invoice…</h1>
      </div>
    );

  if (state.kind === "not-found")
    return (
      <div className="page invoice-page">
        <span className="eyebrow">Invoice</span>
        <h1>We couldn’t find that invoice</h1>
        <p>It may not exist, or it may belong to another account. Your orders are listed below.</p>
        <div className="center-actions">
          <Button onClick={() => navigate("orders")}>View my orders</Button>
        </div>
      </div>
    );

  if (state.kind === "error")
    return (
      <div className="page invoice-page">
        <span className="eyebrow">Invoice</span>
        <h1>Your invoice could not be loaded</h1>
        <p role="alert">{state.message}</p>
        <div className="center-actions">
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          <Button variant="outline" onClick={() => navigate("orders")}>
            View my orders
          </Button>
        </div>
      </div>
    );

  const { invoice } = state;
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await fetchInvoicePdf(invoice.id, `${invoice.invoiceNumber}.pdf`);
      saveBlob(blob, filename);
    } catch (error) {
      notify(invoiceErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };
  const money = (value: number) => formatAmount(value, invoice.currency);
  const { seller, billedTo, deliverTo, payment } = invoice;

  return (
    <div className="page invoice-page">
      <div className="success-mark">
        <Icon name="check" size={34} />
      </div>
      <span className="eyebrow">Order confirmed</span>
      <h1>Thanks, {firstName(billedTo.name)}!</h1>
      <p>Your order is confirmed. A copy of this invoice is being emailed to {billedTo.email}.</p>
      <article className="invoice">
        <div className="invoice-head">
          <div className="invoice-seller">
            <Logo size="large" tone="dark" />
            <b>{seller.name}</b>
            <span>{seller.address}</span>
            <span>
              {seller.taxOffice} · Tax no. {seller.taxNumber}
            </span>
          </div>
          <div className="invoice-id">
            <small>INVOICE</small>
            <b>{invoice.invoiceNumber}</b>
            <span>{formatInvoiceDate(invoice.issuedAt)}</span>
            <span>Order {invoice.orderNumber}</span>
            {invoice.paid && <span className="status green invoice-paid">PAID</span>}
          </div>
        </div>
        <div className="invoice-meta">
          <div>
            <small>BILLED TO</small>
            <b>{billedTo.name}</b>
            <span>{billedTo.email}</span>
            <span>{billedTo.address}</span>
          </div>
          <div>
            <small>DELIVER TO</small>
            <b>{deliverTo.recipient}</b>
            {addressLines(deliverTo.address, deliverTo.postalCode, deliverTo.city).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <div className="table-wrap invoice-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Model</th>
                <th className="num">Qty</th>
                <th className="num">List price</th>
                <th className="num">Discount</th>
                <th className="num">Price paid</th>
                <th className="num">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.model ?? "—"}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{money(item.unitListPrice)}</td>
                  <td className="num">{formatDiscount(item.discountRate)}</td>
                  <td className="num">{money(item.unitPricePaid)}</td>
                  <td className="num">{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice-totals">
          <div className="invoice-row">
            <span>Subtotal</span>
            <b>{money(invoice.subtotal)}</b>
          </div>
          <div className="invoice-row">
            <span>Discounts</span>
            <b>{invoice.discountTotal > 0 ? `−${money(invoice.discountTotal)}` : money(0)}</b>
          </div>
          <div className="invoice-row">
            <span>Delivery</span>
            <b>{invoice.deliveryFee > 0 ? money(invoice.deliveryFee) : "Free"}</b>
          </div>
          <div className="invoice-row">
            <span>Tax (8%)</span>
            <b>{money(invoice.tax)}</b>
          </div>
          <div className="invoice-row invoice-total">
            <span>TOTAL PAID</span>
            <b>{money(invoice.total)}</b>
          </div>
        </div>
        <div className="invoice-foot">
          {payment && (
            <p>
              Paid by {payment.cardBrand ?? "card"} •••• {payment.cardLast4 ?? "----"}
              {payment.transactionRef && <> · Ref {payment.transactionRef}</>}
            </p>
          )}
          <p>Returns accepted within 30 days of delivery.</p>
        </div>
      </article>
      <div className="center-actions">
        <Button onClick={downloadPdf} disabled={downloading}>
          <Icon name="download" size={18} /> {downloading ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="outline" onClick={() => navigate("orders")}>
          View my orders
        </Button>
      </div>
    </div>
  );
}
