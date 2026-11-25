import { describe, expect, it } from "vitest";
import type { Delivery } from "../services/deliveryApi";
import {
  countByFilter,
  filterDeliveries,
  formatDate,
  nextAction,
  replaceDelivery,
  shortCustomerId,
  sortDeliveries,
  statusClass,
  statusLabel,
} from "./deliveries";

/** SCRUM-34. What the Deliveries page shows and which button a row gets. */
const row = (id: number, status: Delivery["status"], createdAt = "2026-11-20T10:00:00Z"): Delivery => ({
  id,
  deliveryNumber: `DLV-${id}`,
  orderId: 1,
  orderNumber: "RLY-000001",
  customerId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  productId: 1,
  productName: "AeroStride Pro",
  quantity: 1,
  totalPrice: 127.2,
  deliveryAddress: "123 Fast Lane, Istanbul",
  status,
  isCompleted: status === "delivered",
  deliveredAt: status === "delivered" ? "2026-11-22T09:00:00Z" : null,
  createdAt,
});

describe("nextAction", () => {
  it("offers one forward step to a processing delivery, without a confirmation", () => {
    expect(nextAction("processing")).toEqual({
      next: "in_transit",
      label: "Mark in transit",
      needsConfirmation: false,
    });
  });

  it("offers Mark delivered to an in-transit delivery, and asks first", () => {
    expect(nextAction("in_transit")).toEqual({
      next: "delivered",
      label: "Mark delivered",
      needsConfirmation: true,
    });
  });

  it("offers nothing once a delivery is delivered or cancelled", () => {
    expect(nextAction("delivered")).toBeNull();
    expect(nextAction("cancelled")).toBeNull();
  });
});

describe("status badges", () => {
  it("names and colours each status", () => {
    expect(statusLabel("in_transit")).toBe("In transit");
    expect(statusClass("processing")).toBe("orange-status");
    expect(statusClass("in_transit")).toBe("blue");
    expect(statusClass("delivered")).toBe("green");
  });
});

describe("filter tabs", () => {
  const rows = [row(1, "processing"), row(2, "in_transit"), row(3, "delivered"), row(4, "processing")];

  it("counts each tab, with All counting every row", () => {
    expect(countByFilter(rows)).toEqual({ all: 4, processing: 2, in_transit: 1, delivered: 1 });
  });

  it("shows every row on All and only the matching rows on a status tab", () => {
    expect(filterDeliveries(rows, "all")).toHaveLength(4);
    expect(filterDeliveries(rows, "processing").map((r) => r.id)).toEqual([1, 4]);
    expect(filterDeliveries(rows, "delivered").map((r) => r.id)).toEqual([3]);
  });

  it("has zero counts for an empty list", () => {
    expect(countByFilter([])).toEqual({ all: 0, processing: 0, in_transit: 0, delivered: 0 });
  });
});

describe("list order", () => {
  it("puts processing first, then in transit, then delivered, oldest first in each", () => {
    const sorted = sortDeliveries([
      row(1, "delivered", "2026-11-01T00:00:00Z"),
      row(2, "processing", "2026-11-05T00:00:00Z"),
      row(3, "in_transit", "2026-11-03T00:00:00Z"),
      row(4, "processing", "2026-11-02T00:00:00Z"),
    ]);

    expect(sorted.map((r) => r.id)).toEqual([4, 2, 3, 1]);
  });

  it("breaks a timestamp tie by id, exactly even above Number.MAX_SAFE_INTEGER", () => {
    // As numbers both of these round to 9007199254740992.
    const higher = { ...row(1, "processing"), id: "9007199254740993" };
    const lower = { ...row(2, "processing"), id: "9007199254740992" };

    expect(sortDeliveries([higher, lower]).map((r) => r.id)).toEqual([lower.id, higher.id]);
    expect(sortDeliveries([lower, higher]).map((r) => r.id)).toEqual([lower.id, higher.id]);
    // A small id stays a number in the API and still sorts before a large one.
    expect(sortDeliveries([higher, row(7, "processing")]).map((r) => r.id)).toEqual([7, higher.id]);
  });

  it("swaps an updated row in and keeps the order", () => {
    const rows = [row(1, "processing", "2026-11-01T00:00:00Z"), row(2, "processing", "2026-11-02T00:00:00Z")];

    const next = replaceDelivery(rows, row(1, "in_transit", "2026-11-01T00:00:00Z"));

    expect(next.map((r) => [r.id, r.status])).toEqual([
      [2, "processing"],
      [1, "in_transit"],
    ]);
    expect(rows[0].status).toBe("processing");
  });
});

describe("table cells", () => {
  it("shows the first block of a customer ID", () => {
    expect(shortCustomerId("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")).toBe("1b9d6bcd");
  });

  it("shows the delivered date in the store's time zone", () => {
    expect(formatDate("2026-11-22T09:00:00Z")).toBe("22 Nov 2026");
    // 22:30 UTC is already the next day in Istanbul (UTC+3).
    expect(formatDate("2026-11-22T22:30:00Z")).toBe("23 Nov 2026");
  });
});
