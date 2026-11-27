import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
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
import type { OrderHistoryItem, OrderHistoryLine } from "../../types/orderHistory";
import type { Product } from "../../types/models";

/** SCRUM-27. The customer's orders, newest first, each with its status, products and invoice. */
export function Orders({
  onOpenInvoice,
  onShop,
  openProduct,
  onReview,
}: {
  onOpenInvoice: (invoiceId: string) => void;
  onShop: () => void;
  openProduct: (p: Product) => void;
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
    <div className="page orders-page">
      <div className="orders-heading">
        <h1>My orders</h1>
        <button className="pill pill-blue" onClick={onShop}>
          Continue shopping →
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && orders === null && (
        <div className="order-list">
          <span className="sr-only" role="status">
            Loading your orders
          </span>
          <Skeleton className="order-skeleton" />
          <Skeleton className="order-skeleton" />
        </div>
      )}
      {orders?.length === 0 && (
        <EmptyState
          icon="truck"
          title="No orders yet"
          text="When you place an order, you can follow its delivery here."
          action="Start shopping"
          onAction={onShop}
        />
      )}

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
                  <div className="order-product-line" key={line.id}>
                    <button
                      type="button"
                      className="order-product-open"
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
                        {line.review && (
                          <small>
                            Your rating: {line.review.rating}/5
                            {line.review.commentStatus && ` · Comment ${line.review.commentStatus}`}
                          </small>
                        )}
                      </span>
                    </button>
                    {line.delivered && !(line.review?.hasComment ?? Boolean(line.review?.commentStatus)) && (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={line.review ? `Add a comment for ${line.name}` : `Write a review for ${line.name}`}
                        onClick={() => onReview(line)}
                      >
                        {line.review ? "Add a comment" : "Write a review"}
                      </Button>
                    )}
                  </div>
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
