import { useState } from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Stars } from "../../components/ui/Stars";

export function ReviewQueue({ notify }: { notify: (s: string) => void }) {
  const [queue, setQueue] = useState([
    {
      id: 1,
      user: "Nora B.",
      product: "AeroStride Pro",
      rating: 5,
      copy: "Super light and responsive. Great for tempo runs.",
    },
    {
      id: 2,
      user: "Daniel K.",
      product: "PowerGrip Gloves",
      rating: 4,
      copy: "Good grip and comfortable wrist support.",
    },
  ]);
  const resolve = (id: number, action: string) => {
    setQueue(queue.filter((r) => r.id !== id));
    notify(`Review ${action}`);
  };
  return (
    <DashboardShell eyebrow="Community quality" title="Review approval queue">
      <div className="queue-grid">
        {queue.map((r) => (
          <article className="review-queue" key={r.id}>
            <div className="review-user">
              <span>{r.user[0]}</span>
              <div>
                <b>{r.user}</b>
                <small>{r.product}</small>
              </div>
            </div>
            <Stars rating={r.rating} />
            <p>“{r.copy}”</p>
            <div>
              <Button onClick={() => resolve(r.id, "approved")}>Approve</Button>
              <Button variant="ghost" onClick={() => resolve(r.id, "rejected")}>
                Reject
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!queue.length && <div className="empty">All reviews have been processed.</div>}
    </DashboardShell>
  );
}
