import { useState } from "react";
import { products, categories } from "../../services/mockStore";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Stat } from "../../components/ui/Stat";
import { money } from "../../utils/format";

export function ProductManagement({ notify }: { notify: (s: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [local, setLocal] = useState(products.slice(0, 6));
  const [adminPrice, setAdminPrice] = useState(100);
  const [adminCost, setAdminCost] = useState(50);
  return (
    <DashboardShell
      eyebrow="Catalog operations"
      title="Products"
      actions={
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Icon name="plus" size={18} /> Add product
        </Button>
      }
    >
      {showAdd && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setShowAdd(false);
            notify("New product added");
          }}
        >
          <label>
            Product ID
            <input required defaultValue="RLY-P-0009" />
          </label>
          <label>
            Product name
            <input required placeholder="Product name" />
          </label>
          <label>
            Model
            <input required placeholder="RLY-2025-09" />
          </label>
          <label>
            Serial number
            <input required placeholder="R-90872" />
          </label>
          <label className="wide-field">
            Description
            <textarea required placeholder="Materials, fit, and performance details" />
          </label>
          <label>
            Category
            <select>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity in stock
            <input required type="number" placeholder="0" />
          </label>
          <label>
            Price
            <input
              required
              type="number"
              value={adminPrice}
              onChange={(e) => {
                const nextPrice = Number(e.target.value);
                setAdminPrice(nextPrice);
                setAdminCost(Number((nextPrice * 0.5).toFixed(2)));
              }}
            />
          </label>
          <label>
            Optional cost
            <input
              type="number"
              value={adminCost}
              onChange={(e) => setAdminCost(Number(e.target.value))}
            />
          </label>
          <label>
            Warranty status
            <select>
              <option>Active</option>
              <option>Expired</option>
              <option>Not applicable</option>
            </select>
          </label>
          <label>
            Warranty term
            <input required placeholder="24 months" />
          </label>
          <label>
            Distributor
            <input required placeholder="Distributor name" />
          </label>
          <Button type="submit">Save product</Button>
        </form>
      )}
      <div className="stats-row">
        <Stat label="Active products" value="128" change="+8 this month" />
        <Stat label="Low stock" value="12" change="Needs attention" warning />
        <Stat label="Out of stock" value="4" change="Restock now" warning />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {local.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="table-product">
                    <img src={p.image} alt="" />
                    <div>
                      <b>{p.name}</b>
                      <small>{p.model}</small>
                    </div>
                  </div>
                </td>
                <td>{p.category}</td>
                <td>{money(p.price)}</td>
                <td>
                  <input
                    className="stock-input"
                    type="number"
                    defaultValue={p.stock}
                    onBlur={() => notify("Stock updated")}
                  />
                </td>
                <td>
                  <span className={`status ${p.stock ? "green" : "red"}`}>
                    {p.stock ? "Active" : "Out of stock"}
                  </span>
                </td>
                <td>
                  <button
                    className="danger-link"
                    onClick={() => setLocal(local.filter((item) => item.id !== p.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
