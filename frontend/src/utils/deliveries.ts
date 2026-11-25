import type { Delivery, DeliveryStatus } from "../services/deliveryApi";

export type DeliveryFilter = "all" | "processing" | "in_transit" | "delivered";

export const FILTERS: { key: DeliveryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "in_transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
];

const LABELS: Record<DeliveryStatus, string> = {
  processing: "Processing",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const statusLabel = (status: DeliveryStatus) => LABELS[status];

/** Colour class of the badge, on top of the shared "status" class. */
export function statusClass(status: DeliveryStatus): string {
  if (status === "delivered") return "green";
  if (status === "in_transit") return "blue";
  if (status === "cancelled") return "red";
  return "orange-status";
}

export interface DeliveryAction {
  next: "in_transit" | "delivered";
  label: string;
  /** Marking a delivery as delivered completes it, so the page asks first. */
  needsConfirmation: boolean;
}

/** The one forward step of an open delivery; none once it is delivered or cancelled. */
export function nextAction(status: DeliveryStatus): DeliveryAction | null {
  if (status === "processing") {
    return { next: "in_transit", label: "Mark in transit", needsConfirmation: false };
  }
  if (status === "in_transit") {
    return { next: "delivered", label: "Mark delivered", needsConfirmation: true };
  }
  return null;
}

export function filterDeliveries(rows: Delivery[], filter: DeliveryFilter): Delivery[] {
  return filter === "all" ? rows : rows.filter((row) => row.status === filter);
}

export function countByFilter(rows: Delivery[]): Record<DeliveryFilter, number> {
  const counts: Record<DeliveryFilter, number> = {
    all: rows.length,
    processing: 0,
    in_transit: 0,
    delivered: 0,
  };
  for (const row of rows) {
    if (row.status !== "cancelled") counts[row.status] += 1;
  }
  return counts;
}

const STATUS_RANK: Record<DeliveryStatus, number> = {
  processing: 0,
  in_transit: 1,
  delivered: 2,
  cancelled: 3,
};

/** Ids above Number.MAX_SAFE_INTEGER arrive as strings, so they are compared as BigInt. */
function compareIds(a: Delivery["id"], b: Delivery["id"]): number {
  return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
}

/** The server's order: processing, then in transit, then delivered, oldest first in each. */
export function sortDeliveries(rows: Delivery[]): Delivery[] {
  return [...rows].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      compareIds(a.id, b.id),
  );
}

/** Swaps the updated row into the list and keeps the list in the server's order. */
export function replaceDelivery(rows: Delivery[], updated: Delivery): Delivery[] {
  return sortDeliveries(rows.map((row) => (row.id === updated.id ? updated : row)));
}

/** A customer ID is a UUID; the table shows its first block and keeps the whole one in a tooltip. */
export const shortCustomerId = (id: string) => id.split("-")[0];

/** Dates are shown in the store's time zone, like the invoice. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
}
