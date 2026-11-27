import { useId } from "react";

const RIBBON =
  "M30 60 C30 15, 95 15, 120 60 C145 105, 210 105, 210 60 C210 15, 145 15, 120 60 C95 105, 30 105, 30 60";
/** Drawn again on top so the ribbon visibly crosses over itself in the middle. */
const CROSSING =
  "M91.90 32.78 C102.86 38.33, 113.00 47.40, 120.00 60.00 C127.00 72.60, 137.14 81.67, 148.10 87.22";

function Ribbon({ backdrop, ball }: { backdrop: string; ball: boolean }) {
  const gradient = `loop-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stroke = `url(#${gradient})`;
  return (
    <>
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="210" y2="0">
          <stop offset="0" stopColor="#38B6F0" />
          <stop offset=".5" stopColor="#D83995" />
          <stop offset="1" stopColor="#FC734D" />
        </linearGradient>
      </defs>
      <path d={RIBBON} fill="none" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
      <path d={CROSSING} fill="none" stroke={backdrop} strokeWidth="24" strokeLinecap="butt" />
      <path d={CROSSING} fill="none" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
      {ball && (
        <circle className="logo-ball" r="8" fill="#ffffff">
          <animateMotion dur="4.5s" repeatCount="indefinite" path={RIBBON} />
        </circle>
      )}
    </>
  );
}

/** The infinity loop on its own. `backdrop` is the colour behind it, used where the ribbon crosses. */
export function LoopMark({
  width,
  height,
  backdrop,
  ball = false,
}: {
  width: number;
  height: number;
  backdrop: string;
  ball?: boolean;
}) {
  return (
    <svg width={width} height={height} viewBox="20 10 200 100" aria-hidden="true">
      <Ribbon backdrop={backdrop} ball={ball} />
    </svg>
  );
}

/**
 * The stacked RALLY logo. `tone` is the colour of the lettering: "light" for dark backgrounds,
 * "dark" for white ones such as the invoice.
 */
export function Logo({
  size = "nav",
  tone = "light",
  backdrop,
}: {
  size?: "nav" | "large";
  tone?: "light" | "dark";
  backdrop?: string;
}) {
  const behind = backdrop ?? (tone === "light" ? "#070D12" : "#ffffff");
  const ink = tone === "light" ? "#ffffff" : "#02070A";

  if (size === "nav") {
    return (
      <span className={`logo logo-${tone}`}>
        <span className="logo-name">RALLY</span>
        <LoopMark width={56} height={28} backdrop={behind} ball />
      </span>
    );
  }

  return (
    <svg className="logo-large" viewBox="0 0 480 240" role="img" aria-label="RALLY sports store">
      <text x="240" y="92" textAnchor="middle" fontFamily="Italiana, serif" fontSize="74" letterSpacing="14" fill={ink}>
        RALLY
      </text>
      <g transform="translate(174 106) scale(.55)">
        <Ribbon backdrop={behind} ball />
      </g>
      <text
        x="244"
        y="196"
        textAnchor="middle"
        fontFamily="'Inter Tight', sans-serif"
        fontWeight="300"
        fontSize="11"
        letterSpacing="10"
        fill={tone === "light" ? "#9FB3C2" : "#5B6772"}
      >
        SPORTS STORE
      </text>
    </svg>
  );
}
