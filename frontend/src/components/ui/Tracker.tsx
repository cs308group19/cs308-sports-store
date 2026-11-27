import type { OrderStatus } from "../../types/models";
import { Icon } from "./Icon";

const STEPS: OrderStatus[] = ["Processing", "In transit", "Delivered"];

/**
 * The three delivery steps. The bar fills up to the current step when the card appears, the
 * current step pulses, and a delivered order shows every step ticked in green.
 */
export function Tracker({ status }: { status: OrderStatus }) {
  const active = STEPS.indexOf(status);
  const delivered = status === "Delivered";
  return (
    <ol className={`tracker ${delivered ? "tracker--delivered" : ""}`}>
      <li className="tracker-bar" aria-hidden="true">
        <span style={{ "--filled": active / (STEPS.length - 1) } as React.CSSProperties} />
      </li>
      {STEPS.map((step, i) => {
        const done = delivered || i < active;
        const current = !delivered && i === active;
        return (
          <li className={done ? "done" : current ? "current" : ""} aria-current={current ? "step" : undefined} key={step}>
            <span>{done ? <Icon name="check" size={16} /> : i + 1}</span>
            <b>{step}</b>
          </li>
        );
      })}
    </ol>
  );
}
