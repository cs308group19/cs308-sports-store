import { describe, expect, it } from "vitest";
import { cartTotals } from "./cartTotals";

/** SCRUM-62 (checkout). The cart page and the checkout page show these amounts. */
const line = (price: number, quantity: number) => ({ price, quantity });

describe("cartTotals", () => {
  it("costs nothing for an empty cart, not even delivery", () => {
    expect(cartTotals([])).toEqual({ subtotal: 0, delivery: 0, tax: 0, total: 0 });
  });

  it("charges delivery and 8% tax below the free-delivery amount", () => {
    expect(cartTotals([line(20, 2), line(10, 1)])).toEqual({
      subtotal: 50,
      delivery: 8,
      tax: 4,
      total: 62,
    });
  });

  it("ships for free from exactly 75.00", () => {
    expect(cartTotals([line(75, 1)]).delivery).toBe(0);
    expect(cartTotals([line(74.99, 1)]).delivery).toBe(8);
  });

  it("multiplies each price by its quantity", () => {
    expect(cartTotals([line(127.2, 3)]).subtotal).toBe(381.6);
  });

  it("works in cents, so float errors never reach the total", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in plain floating point.
    const totals = cartTotals([line(0.1, 1), line(0.2, 1)]);
    expect(totals.subtotal).toBe(0.3);
    expect(totals.tax).toBe(0.02);
    expect(totals.total).toBe(8.32);
  });

  it("rounds the tax to the nearest cent", () => {
    // 8% of 19.99 is 1.5992.
    expect(cartTotals([line(19.99, 1)]).tax).toBe(1.6);
  });
});
