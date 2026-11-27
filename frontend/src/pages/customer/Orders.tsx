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
import { productStub } from "../../utils/productStub";
import type { OrderHistoryItem } from "../../types/orderHistory";
import type { Product } from "../../types/models";

/** SCRUM-27. The customer's orders, newest first, each with its status, products and invoice. */
export function Orders({
  onOpenInvoice,
  onShop,
  openProduct,
}: {
  onOpenInvoice: (invoiceId: string) => void;
  onShop: () => void;
  openProduct: (p: Product) => void;
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
    <div className="page orders-page">
      <div className="orders-heading">
        <h1>My orders</h1>
        <button className="pill pill-blue" onClick={onShop}>
          Continue shopping →
        </button>
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
                  <span className="order-number">ORDER {order.orderNumber}</span>
                  <b>
                    {formatInvoiceDate(order.placedAt)} · {money(order.total)}
                  </b>
                </div>
                <div className="order-state">
                  <small>Status</small>
                  <strong className={order.status}>{ORDER_STATUS_LABEL[order.status]}</strong>
                </div>
              </div>

              {step && <Tracker status={step} />}

              <div className="order-products">
                {order.items.map((line) => (
                  <button
                    className="order-product-line"
                    key={line.id}
                    onClick={() =>
                      openProduct(
                        productStub({
                          id: line.productId,
                          name: line.name,
                          price: line.unitPricePaid,
                          image: orderLineImage(line),
                          model: line.model,
                        }),
                      )
                    }
                  >
                    <img src={orderLineImage(line)} alt="" width="56" height="56" loading="lazy" />
                    <span>
                      <b>{line.name}</b>
                      <small>
                        Qty {line.quantity} · Paid {money(line.unitPricePaid)} each ·{" "}
                        {money(line.lineTotal)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>

              {order.invoiceId != null && (
                <Button variant="outline" onClick={() => onOpenInvoice(String(order.invoiceId))}>
                  View invoice
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
