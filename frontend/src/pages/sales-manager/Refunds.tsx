import { useState } from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { money } from "../../utils/format";

export function Refunds({ notify }: { notify: (s: string) => void }) {
  const [requests, setRequests] = useState([
    {
      id: "RF-3108",
      customer: "Maya Chen",
      order: "RLY-79984",
      item: "Velocity Knit",
      amount: 99,
      originalPrice: 119,
      discount: 16.8,
      reason: "Wrong size",
    },
    {
      id: "RF-3109",
      customer: "Sam Reed",
      order: "RLY-80112",
      item: "Court Vision Elite",
      amount: 145,
      originalPrice: 170,
      discount: 14.7,
      reason: "Changed mind",
    },
  ]);
  const approve = (id: string, amount: number) => {
    setRequests(requests.filter((r) => r.id !== id));
    notify(`Stock restored, customer emailed refund amount ${money(amount)}`);
  };
  return (
    <DashboardShell eyebrow="Returns & refunds" title="Refund requests">
      <div className="queue-grid">
        {requests.map((r) => (
          <article className="refund-card" key={r.id}>
            <div>
              <span className="status orange-status">Pending</span>
              <small>{r.id}</small>
            </div>
            <h3>{r.item}</h3>
            <p>
              {r.customer} · Order #{r.order}
            </p>
            <div className="refund-reason">
              <span>Reason</span>
              <b>{r.reason}</b>
            </div>
            <div className="refund-amount">
              <span>
                Price paid at purchase
                <small>
                  {money(r.originalPrice)} less {r.discount}% discount
                </small>
              </span>
              <b>{money(r.amount)}</b>
            </div>
            <Button onClick={() => approve(r.id, r.amount)}>
              Approve {money(r.amount)} refund
            </Button>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
