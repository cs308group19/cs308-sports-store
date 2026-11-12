export function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span className={star <= rounded ? "" : "empty-star"} key={star}>
          ★
        </span>
      ))}{" "}
      <small>{rating}</small>
    </span>
  );
}
