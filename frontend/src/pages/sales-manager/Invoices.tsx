import { orders } from "../../services/mockStore";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { money } from "../../utils/format";

export function Invoices({
  notify,
  manager = "sales",
}: {
  notify: (s: string) => void;
  manager?: "sales" | "product";
}) {
  return (
    <DashboardShell
      eyebrow={manager === "product" ? "Fulfillment records" : "Financial records"}
      title={manager === "product" ? "Product invoices" : "Invoices"}
      actions={
        <div className="button-group">
          <Button
            variant="outline"
            onClick={() => {
              notify("Print dialog opened");
              window.print();
            }}
          >
            Print
          </Button>
          <Button onClick={() => notify("Invoice report saved as PDF")}>
            <Icon name="download" size={18} /> Save as PDF
          </Button>
        </div>
      }
    >
      <div className="filters">
        <label>
          From
          <input type="date" defaultValue="2025-05-01" />
        </label>
        <label>
          To
          <input type="date" defaultValue="2025-05-24" />
        </label>
        <Button variant="dark">Apply range</Button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Payment</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id}>
                <td>
                  <b>INV-{8104 + i}</b>
                </td>
                <td>{["Jamie Taylor", "Maya Chen", "Leo Martin"][i]}</td>
                <td>{o.date}</td>
                <td>
                  <span className="status green">Paid</span>
                </td>
                <td>
                  <b>{money(o.total)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
