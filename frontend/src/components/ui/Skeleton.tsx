/** A shimmering placeholder shown while content loads (still with reduced motion). */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** `count` card-shaped placeholders for a product grid, with a message for screen readers. */
export function SkeletonCards({ count, label }: { count: number; label: string }) {
  return (
    <>
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="skeleton-card" />
      ))}
    </>
  );
}
