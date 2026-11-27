import { useId } from "react";
import { LoopMark, RIBBON } from "../ui/Logo";

/** The loop on the closed bubble, with the ball travelling around it. */
export function BubbleMark({ ball }: { ball: boolean }) {
  return <LoopMark width={44} height={22} backdrop="#0B1620" ball={ball} ballSeconds={3.5} />;
}

/** The small loop in the panel header: one stroke, no ball. */
export function HeaderMark() {
  const gradient = `rally-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className="rally-tile">
      <svg width="28" height="14" viewBox="20 10 200 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="210" y2="0">
            <stop offset="0" stopColor="#38B6F0" />
            <stop offset=".5" stopColor="#D83995" />
            <stop offset="1" stopColor="#FC734D" />
          </linearGradient>
        </defs>
        <path d={RIBBON} fill="none" stroke={`url(#${gradient})`} strokeWidth="18" strokeLinecap="round" />
      </svg>
    </span>
  );
}
