import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Tracker } from "../../components/ui/Tracker";
import { money } from "../../utils/format";
import {
  fetchOrderHistory,
  ORDER_STATUS_LABEL,
  orderErrorMessage,
  orderLineImage,
  trackerStep,
} from "../../services/orderApi";
import { formatInvoiceDate } from "../../utils/invoiceFormat";
import type { OrderHistoryItem, OrderHistoryLine } from "../../types/orderHistory";

/** SCRUM-27. The customer's orders, newest first, each with its status, products and invoice. */
export function Orders({ onOpenInvoice, onReview }: {
  onOpenInvoice: (invoiceId: string) => void;
  onReview: (line: OrderHistoryLine) => void;
}) {
  const [orders, setOrders] = useState<OrderHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOrderHistory()
      .then((list) => {
        if (active) setOrders(list);
      })
      .catch((caught: unknown) => {
        if (active) setError(orderErrorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Order history</span>
        <h1>My orders</h1>
        <p>Track your deliveries and see what you bought.</p>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && orders === null && <p>Loading your orders…</p>}
      {orders?.length === 0 && <p>You have not placed any orders yet.</p>}

      <div className="order-list">
        {orders?.map((order) => {
          const step = trackerStep(order.status);
          return (
            <article className="order-card" key={order.id}>
              <div className="order-head">
                <div>
                  <small>ORDER</small>
                  <b>{order.orderNumber}</b>
                </div>
                <div>
                  <small>PLACED</small>
                  <b>{formatInvoiceDate(order.placedAt)}</b>
                </div>
                <div>
                  <small>TOTAL</small>
                  <b>{money(order.total)}</b>
                </div>
                {order.invoiceId != null && (
                  <Button
                    variant="outline"
                    onClick={() => onOpenInvoice(String(order.invoiceId))}
                  >
                    View invoice
                  </Button>
                )}
              </div>

              {step ? (
                <Tracker status={step} />
              ) : (
                <p>
                  <span className="status red">{ORDER_STATUS_LABEL[order.status]}</span>
                </p>
              )}

              <div className="order-products">
                {order.items.map((line) => (
                  <div className="order-product-line" key={line.id}>
                    <img src={orderLineImage(line)} alt="" />
                    <span>
                      <b>{line.name}</b>
                      <small>
                        Qty {line.quantity} · Paid {money(line.unitPricePaid)} each ·{" "}
                        {money(line.lineTotal)}
                      </small>
                      {line.review && (
                        <small>
                          Your rating: {line.review.rating}/5
                          {line.review.commentStatus && ` · Comment ${line.review.commentStatus}`}
                        </small>
                      )}
                    </span>
                    {line.delivered && !(line.review?.hasComment ?? Boolean(line.review?.commentStatus)) && (
                      <Button type="button" variant="outline" onClick={() => onReview(line)}>
                        {line.review ? "Add a comment" : "Write a review"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
