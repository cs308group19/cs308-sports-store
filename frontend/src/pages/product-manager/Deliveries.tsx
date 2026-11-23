import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import {
  type Delivery,
  deliveryErrorMessage,
  fetchDeliveries,
} from "../../services/deliveryApi";
import {
  type DeliveryFilter,
  countByFilter,
  filterDeliveries,
  FILTERS,
  formatDate,
  shortCustomerId,
  sortDeliveries,
  statusClass,
  statusLabel,
} from "../../utils/deliveries";
import { money } from "../../utils/format";

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/**
 * SCRUM-34. The product manager's delivery list, from GET /api/staff/deliveries. A delivery only
 * moves forward (processing, in transit, delivered); the server enforces it.
 */
export function Deliveries() {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<DeliveryFilter>("all");
  const load = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!options.quiet) setState({ status: "loading" });
    try {
      setRows(sortDeliveries(await fetchDeliveries()));
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", message: deliveryErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = countByFilter(rows);
  const visible = filterDeliveries(rows, filter);

  return (
    <DashboardShell eyebrow="Fulfillment" title="Deliveries">
      {state.status === "error" ? (
        <div className="empty">
          <h2>Deliveries could not be loaded</h2>
          <p>{state.message}</p>
          <Button onClick={() => void load()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="auth-tabs" role="tablist" aria-label="Filter deliveries by status">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
          <div className="table-wrap" aria-busy={state.status === "loading"}>
            {state.status === "loading" ? (
              <div className="empty">Loading deliveries...</div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <h2>{rows.length === 0 ? "No deliveries yet" : "No deliveries in this view"}</h2>
                {rows.length === 0 && <p>Deliveries appear here after customers place orders.</p>}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Delivery #</th>
                    <th>Order #</th>
                    <th>Customer ID</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <b>{d.deliveryNumber}</b>
                      </td>
                      <td>{d.orderNumber}</td>
                      <td title={d.customerId}>{shortCustomerId(d.customerId)}</td>
                      <td>{d.productName}</td>
                      <td>{d.quantity}</td>
                      <td>{money(d.totalPrice)}</td>
                      <td>{d.deliveryAddress}</td>
                      <td>
                        <span className={`status ${statusClass(d.status)}`}>{statusLabel(d.status)}</span>
                      </td>
                      <td>
                        <span className={`status ${d.isCompleted ? "green" : "orange-status"}`}>
                          {d.isCompleted ? "Yes" : "No"}
                        </span>
                        {d.deliveredAt && <small> {formatDate(d.deliveredAt)}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
