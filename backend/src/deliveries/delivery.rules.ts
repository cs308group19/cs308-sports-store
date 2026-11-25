import { OrderStatus } from '../generated/prisma/enums.js';

export { OrderStatus };

/** The steps a delivery goes through, in order. `cancelled` is not a step. */
export const DELIVERY_STEPS = [
  OrderStatus.processing,
  OrderStatus.in_transit,
  OrderStatus.delivered,
] as const;

export type DeliveryStep = (typeof DELIVERY_STEPS)[number];

export function isDeliveryStep(value: unknown): value is DeliveryStep {
  return (DELIVERY_STEPS as readonly unknown[]).includes(value);
}

/** 0 for processing, 1 for in transit, 2 for delivered. */
function rank(status: DeliveryStep): number {
  return DELIVERY_STEPS.indexOf(status);
}

export type TransitionCheck =
  { allowed: true } | { allowed: false; reason: string };

const LABEL: Record<OrderStatus, string> = {
  processing: 'processing',
  in_transit: 'in transit',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/**
 * SCRUM-34. A delivery only moves forward, one or more steps: processing -> in_transit ->
 * delivered. Going back, repeating the current status and "cancelled" are refused.
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
): TransitionCheck {
  if (to === OrderStatus.cancelled) {
    return {
      allowed: false,
      reason: 'A delivery cannot be cancelled from this page.',
    };
  }
  if (!isDeliveryStep(from)) {
    return {
      allowed: false,
      reason: `This delivery is ${LABEL[from]} and can no longer change.`,
    };
  }
  if (from === to) {
    return {
      allowed: false,
      reason: `This delivery is already ${LABEL[from]}.`,
    };
  }
  if (rank(to) < rank(from)) {
    return {
      allowed: false,
      reason: `A delivery cannot go back from ${LABEL[from]} to ${LABEL[to]}.`,
    };
  }
  return { allowed: true };
}

/**
 * The status an order shows is that of its least advanced delivery row (shared order contract).
 * Cancelled rows are ignored; an order with only cancelled rows is cancelled, and an order
 * without delivery rows has no status to derive.
 */
export function orderStatusFromDeliveries(
  statuses: readonly OrderStatus[],
): OrderStatus | null {
  if (statuses.length === 0) return null;
  const open = statuses.filter(isDeliveryStep);
  if (open.length === 0) return OrderStatus.cancelled;
  return open.reduce((least, status) =>
    rank(status) < rank(least) ? status : least,
  );
}
