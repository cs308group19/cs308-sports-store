import { useState } from "react";
import { products } from "../../services/mockStore";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { money } from "../../utils/format";

export function Pricing({ notify }: { notify: (s: string) => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([1, 3]);
  const [discountRate, setDiscountRate] = useState(20);
  const toggle = (id: number) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  return (
    <DashboardShell
      eyebrow="Merchandising"
      title="Prices & discounts"
      actions={
        <Button onClick={() => notify("Discount published — wishlist customers notified")}>
          Publish changes
        </Button>
      }
    >
      <div className="notice">
        <Icon name="heart" />
        <span>
          <b>Wishlist customers notified</b>
          <small>
            Publishing sends the calculated price to customers who saved these products.
          </small>
        </span>
      </div>
      <div className="discount-builder">
        <label>
          Discount rate
          <div className="rate-input">
            <input
              type="number"
              min="0"
              max="100"
              value={discountRate}
              onChange={(e) => setDiscountRate(Math.min(100, Math.max(0, Number(e.target.value))))}
            />
            <span>%</span>
          </div>
        </label>
        <div>
          <small>SELECTED PRODUCTS</small>
          <b>{selectedIds.length}</b>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Product</th>
              <th>Current price</th>
              <th>Discount rate</th>
              <th>Calculated new price</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 6).map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </td>
                <td>
                  <b>{p.name}</b>
                </td>
                <td>{money(p.price)}</td>
                <td>{selectedIds.includes(p.id) ? `${discountRate}%` : "—"}</td>
                <td>
                  <b className="orange">
                    {selectedIds.includes(p.id)
                      ? money(p.price * (1 - discountRate / 100))
                      : money(p.price)}
                  </b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
