import type { ReactNode } from "react";
import { useTilt } from "../../hooks/useTilt";

/** Leans its content towards the mouse, with a light glare that follows the cursor. */
export function TiltCard({
  max = 8,
  className = "",
  children,
}: {
  /** The largest tilt, in degrees. */
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const tilt = useTilt(max);
  return (
    // The outer box stays flat, so the pointer is always measured against the same rectangle.
    <div className={`tilt ${className}`} {...tilt}>
      <div className="tilt-inner">
        {children}
        <span className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}
