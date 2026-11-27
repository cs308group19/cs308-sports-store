import { useState } from "react";
import { gearTips } from "../../content/gearTips";
import { useReveal } from "../../hooks/useReveal";
import { SectionTitle } from "./SectionTitle";

export function GearCards() {
  const reveal = useReveal();
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(new Set());
  const flip = (index: number) =>
    setFlipped((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <section className="home-section gear">
      <div className="gear-head">
        <SectionTitle title="Tap a card." reveal={reveal} />
        <p>Quick answers before you buy.</p>
      </div>
      <div className="gear-grid">
        {gearTips.map((tip, index) => {
          const open = flipped.has(index);
          return (
            <div key={tip.question} ref={reveal} style={{ "--delay": `${index * 100}ms` } as React.CSSProperties}>
              <button className="flip-card" aria-pressed={open} onClick={() => flip(index)}>
                <span className={`flip-inner ${open ? "flipped" : ""}`}>
                  <span className="flip-face flip-front" style={{ background: tip.gradient }} aria-hidden={open}>
                    <span className="flip-tag">{tip.tag}</span>
                    <b>{tip.question}</b>
                    <small>Tap to flip ↻</small>
                  </span>
                  <span className="flip-face flip-back" aria-hidden={!open}>
                    <span className="flip-tag">ANSWER</span>
                    <span>{tip.answer}</span>
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
