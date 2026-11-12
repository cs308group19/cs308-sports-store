import { useState } from "react";
import { orders } from "../../services/mockStore";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";

export function ReviewForm({
  notify,
  navigate,
}: {
  notify: (s: string) => void;
  navigate: (v: View) => void;
}) {
  const [rating, setRating] = useState(5);
  const [ratingSaved, setRatingSaved] = useState(false);
  return (
    <div className="page form-page">
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          notify("Comment saved — Pending product manager approval");
          navigate("product");
        }}
      >
        <span className="eyebrow">Verified purchase</span>
        <h1>Rate your gear</h1>
        <p>Only delivered purchases can be rated or commented on.</p>
        <label>
          Delivered product
          <select required>
            {orders
              .filter((order) => order.status === "Delivered")
              .flatMap((order) => order.products)
              .map((line) => (
                <option key={line.product.id}>{line.product.name}</option>
              ))}
          </select>
        </label>
        <div className="rating-input">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              type="button"
              className={i <= rating ? "active" : ""}
              onClick={() => {
                setRating(i);
                setRatingSaved(true);
                notify(`${i}-star rating saved`);
              }}
              key={i}
            >
              ★
            </button>
          ))}
        </div>
        {ratingSaved && <span className="saved-note">Rating saved immediately</span>}
        <label>
          Comment
          <textarea required rows={5} placeholder="How did it perform?" />
        </label>
        <div className="notice compact">
          <span>
            <b>Pending product manager approval</b>
            <small>Your comment appears publicly after approval.</small>
          </span>
        </div>
        <Button type="submit">Submit comment</Button>
      </form>
    </div>
  );
}
