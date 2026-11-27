import { useRef } from "react";
import type { Product } from "../../types/models";
import { prefersReducedMotion } from "../../hooks/useMediaQuery";
import { useRafScroll } from "../../hooks/useRafScroll";
import { shortMoney } from "../../utils/format";
import { clamp } from "../../utils/motion";
import { scrollToSection } from "../../utils/scrollToSection";

/** One rally: the ball goes right, bounces, and comes back. */
const RALLY_PATH = "M80 430 Q 400 80 700 690 Q 880 380 1360 420 Q 1040 60 760 690 Q 560 380 80 430";

const TICKER = ["NIKE", "ADIDAS", "PUMA", "VANS", "CONVERSE", "ASICS", "NEW BALANCE", "SPALDING", "EVERY BRAND · EVERY GAME"];

function TickerRun({ hidden = false }: { hidden?: boolean }) {
  return (
    <span className="ticker-run" aria-hidden={hidden || undefined}>
      {TICKER.map((word, index) => (
        <span key={word}>
          {word}
          <i className={index % 2 ? "blue" : ""}>●</i>
        </span>
      ))}
    </span>
  );
}

/**
 * The full-screen intro. While the page scrolls, the whole panel turns into a rounded card and its
 * content sinks and fades; both are written to CSS custom properties once per frame.
 */
export function RallyIntro({
  drop,
  openProduct,
}: {
  /** The most popular product, shown in the "The drop" card. */
  drop: Product | undefined;
  openProduct: (p: Product) => void;
}) {
  const section = useRef<HTMLElement>(null);

  useRafScroll(() => {
    const element = section.current;
    if (!element) return;
    const still = prefersReducedMotion();
    element.style.setProperty("--shrink", still ? "0" : clamp(window.scrollY / 260, 0, 1).toFixed(3));
    element.style.setProperty("--sink", still ? "0" : clamp(window.scrollY / 700, 0, 1).toFixed(3));
  });

  return (
    <section className="intro" ref={section}>
      <div className="intro-glow blue" />
      <div className="intro-glow orange" />
      <div className="intro-lines" />
      <svg className="intro-court" aria-hidden="true" viewBox="0 0 1440 420" preserveAspectRatio="none">
        <g fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.5">
          <path d="M120 420 L520 30 L920 30 L1320 420 Z" />
          <path d="M720 30 L720 420" />
          <path d="M400 147 L1040 147" />
          <path d="M230 313 L1210 313" />
          <path d="M560 30 L330 420" />
          <path d="M880 30 L1110 420" />
        </g>
        <path d="M90 200 L1350 200" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeDasharray="3 6" />
      </svg>
      <svg className="intro-rally" aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <path d={RALLY_PATH} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2" strokeDasharray="2 10" />
        <path className="rally-trail" d={RALLY_PATH} fill="none" stroke="#38B6F0" strokeWidth="3" strokeLinecap="round" />
        <circle className="rally-ball" r="11" fill="#FC734D">
          <animateMotion dur="7s" repeatCount="indefinite" path={RALLY_PATH} />
        </circle>
      </svg>

      <div className="intro-content">
        <span className="intro-label">RALLY / WINTER 26 — EVERY BRAND, EVERY GAME</span>
        <h1>
          Keep the
          <br />
          <span className="outline">rally</span> <span className="gradient">going.</span>
        </h1>
        <p>Authentic Nike, Adidas, Puma, Vans and more. One store for every sport, every point, every game.</p>
        <div className="intro-actions">
          <button className="pill pill-white" onClick={() => scrollToSection("drop")}>
            Shop now →
          </button>
          <button className="pill pill-line" onClick={() => scrollToSection("brands")}>
            Browse brands
          </button>
        </div>
      </div>

      {drop && (
        <button className="drop-card" onClick={() => openProduct(drop)}>
          <img src={drop.image} alt="" width="76" height="76" />
          <span>
            <span className="drop-card-label">● THE DROP</span>
            <b>{drop.name}</b>
            <span className="drop-card-price">{shortMoney(drop.price)} · Shop now →</span>
          </span>
        </button>
      )}

      <div className="ticker-band">
        <div className="marquee">
          <TickerRun />
          <TickerRun hidden />
        </div>
      </div>
    </section>
  );
}
