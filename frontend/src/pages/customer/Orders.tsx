import { useState } from "react";
import { orders } from "../../services/mockStore";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Tracker } from "../../components/ui/Tracker";
import { money } from "../../utils/format";

export function Orders({
  notify,
  navigate,
}: {
  notify: (s: string) => void;
  navigate: (v: View) => void;
}) {
  const [localOrders, setLocalOrders] = useState(orders);
  const cancel = (id: string) => {
    setLocalOrders(localOrders.filter((o) => o.id !== id));
    notify(`Order ${id} cancelled`);
  };
  return (
    <div className="page narrow">
      <div className="page-heading">
        <span className="eyebrow">Order history</span>
        <h1>My orders</h1>
        <p>Track deliveries, manage returns, and view invoices.</p>
      </div>
      <div className="order-list">
        {localOrders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-head">
              <div>
                <small>ORDER</small>
                <b>#{order.id}</b>
              </div>
              <div>
                <small>PLACED</small>
                <b>{order.date}</b>
              </div>
              <div>
                <small>TOTAL</small>
                <b>{money(order.total)}</b>
              </div>
              <Button variant="outline" onClick={() => navigate("invoice")}>
                View invoice
              </Button>
            </div>
            <Tracker status={order.status} />
            <div className="order-products">
              {order.products.map((line) => (
                <div className="order-product-line" key={line.product.id}>
                  <img src={line.product.image} alt="" />
                  <span>
                    <b>{line.product.name}</b>
                    <small>
                      Product RLY-P-{String(line.product.id).padStart(4, "0")} · Qty {line.quantity}{" "}
                      · Paid {money(line.pricePaid)}
                    </small>
                  </span>
                  {order.status === "Delivered" && order.withinReturnWindow ? (
                    <button
                      onClick={() =>
                        notify(`Return started for ${line.product.name} — within 30-day window`)
                      }
                    >
                      Return this product
                    </button>
                  ) : (
                    <small className="return-status">
                      {order.status !== "Delivered"
                        ? "Return available after delivery"
                        : "30-day return window closed"}
                    </small>
                  )}
                </div>
              ))}
            </div>
            <div className="order-foot">
              <span>
                {order.items} item{order.items > 1 ? "s" : ""}
              </span>
              {order.status === "Processing" && (
                <button onClick={() => cancel(order.id)}>Cancel order</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
