import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { reviewErrorMessage, submitReview } from "../../services/reviewApi";
import type { OrderHistoryLine } from "../../types/orderHistory";

export function ReviewForm({
  line,
  notify,
  backToOrders,
}: {
  line: OrderHistoryLine;
  notify: (message: string) => void;
  backToOrders: () => void;
}) {
  const originalRating = line.review?.rating;
  const [rating, setRating] = useState(originalRating ?? 0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasComment = line.review?.hasComment ?? Boolean(line.review?.commentStatus);

  return (
    <div className="page form-page">
      <form
        className="form-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!rating || busy || hasComment || (originalRating && !comment.trim())) return;
          setBusy(true);
          setError(null);
          try {
            const saved = await submitReview(line.id, rating, comment.trim() || undefined);
            notify(saved.commentStatus === "pending" ? "Comment submitted for approval" : "Rating saved");
            backToOrders();
          } catch (caught) {
            setError(reviewErrorMessage(caught));
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">Verified purchase</span>
        <h1>Rate your gear</h1>
        <p>{line.name}</p>
        <div className="rating-input" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              type="button"
              className={stars <= rating ? "active" : ""}
              aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`}
              aria-pressed={stars === rating}
              disabled={busy || Boolean(originalRating)}
              onClick={() => setRating(stars)}
              key={stars}
            >
              ★
            </button>
          ))}
        </div>
        {!hasComment && (
          <label>
            {originalRating ? "Comment" : "Comment (optional)"}
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={busy}
              maxLength={2000}
              rows={5}
              placeholder="How did it perform?"
            />
          </label>
        )}
        <p>Ratings appear immediately. Written comments appear after approval.</p>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={!rating || busy || hasComment || Boolean(originalRating && !comment.trim())}>
          {busy ? "Saving…" : originalRating ? "Submit comment" : "Save review"}
        </Button>
        <Button type="button" variant="ghost" onClick={backToOrders}>
          Back to orders
        </Button>
      </form>
    </div>
  );
}
