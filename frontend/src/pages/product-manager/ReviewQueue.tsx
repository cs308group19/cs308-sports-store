import { useEffect, useState } from "react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Button } from "../../components/ui/Button";
import { Stars } from "../../components/ui/Stars";
import { ApiError } from "../../lib/api";
import {
  fetchPendingReviews,
  moderateReview,
  type PendingReview,
  type ReviewDecision,
  reviewErrorMessage,
} from "../../services/reviewApi";

type QueueState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; reviews: PendingReview[] };

export function ReviewQueue({ notify }: { notify: (message: string) => void }) {
  const [queue, setQueue] = useState<QueueState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<PendingReview["id"] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPendingReviews()
      .then((reviews) => {
        if (active) setQueue({ status: "ready", reviews });
      })
      .catch((error: unknown) => {
        if (active) setQueue({ status: "error", message: reviewErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function refresh() {
    setQueue({ status: "loading" });
    setRetry((attempt) => attempt + 1);
  }

  async function resolve(id: PendingReview["id"], decision: ReviewDecision) {
    setActionError(null);
    setSaving(id);
    try {
      await moderateReview(id, decision);
      setQueue((current) =>
        current.status === "ready"
          ? { ...current, reviews: current.reviews.filter((review) => review.id !== id) }
          : current,
      );
      notify(`Comment ${decision}`);
    } catch (error) {
      setActionError(reviewErrorMessage(error));
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <DashboardShell eyebrow="Community quality" title="Review approval queue">
      {actionError && queue.status !== "error" && <p role="alert">{actionError}</p>}
      {queue.status === "loading" && <p role="status">Loading comments…</p>}
      {queue.status === "error" && (
        <div className="empty">
          <p role="alert">{queue.message}</p>
          <Button onClick={() => {
            setActionError(null);
            refresh();
          }}>Try again</Button>
        </div>
      )}
      {queue.status === "ready" && (
        queue.reviews.length === 0 ? (
          <div className="empty">No comments waiting for approval.</div>
        ) : (
          <div className="queue-grid">
            {queue.reviews.map((review) => (
              <article className="review-queue" key={review.id} aria-busy={saving === review.id}>
                <div className="review-user">
                  <span aria-hidden="true">{(review.author.trim()[0] ?? "?").toUpperCase()}</span>
                  <div>
                    <b>{review.author}</b>
                    <small>{review.productName}</small>
                  </div>
                </div>
                <Stars rating={review.rating} />
                <p>“{review.comment}”</p>
                <div>
                  <Button disabled={saving !== null} onClick={() => void resolve(review.id, "approved")}>
                    Approve
                  </Button>
                  <Button variant="ghost" disabled={saving !== null} onClick={() => void resolve(review.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </DashboardShell>
  );
}
