import { useEffect, useState } from "react";
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
import type { OrderHistoryItem } from "../../types/orderHistory";

/** SCRUM-27. The customer's orders, newest first, each with its status and products. */
export function Orders() {
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
                    </span>
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
