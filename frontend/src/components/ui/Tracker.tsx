import type { OrderStatus } from "../../types/models";
import { Icon } from "./Icon";

export function Tracker({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = ["Processing", "In transit", "Delivered"];
  const active = steps.indexOf(status);
  return (
    <div className="tracker">
      {steps.map((step, i) => (
        <div className={i <= active ? "done" : ""} key={step}>
          <span>{i < active ? <Icon name="check" size={14} /> : i + 1}</span>
          <b>{step}</b>
        </div>
      ))}
    </div>
  );
}
