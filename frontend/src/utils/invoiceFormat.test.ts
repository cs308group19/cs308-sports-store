import { describe, expect, it } from "vitest";
import {
  addressLines,
  firstName,
  formatAmount,
  formatDiscount,
  formatInvoiceDate,
} from "./invoiceFormat";

/** SCRUM-25. How the invoice page writes amounts, discounts, dates and addresses. */
describe("formatAmount", () => {
  it("writes the amount in the invoice currency with two decimals", () => {
    expect(formatAmount(236.52, "USD")).toBe("$236.52");
    expect(formatAmount(8, "USD")).toBe("$8.00");
    expect(formatAmount(1234.5, "USD")).toBe("$1,234.50");
  });

  it("does not fail on a currency code it does not know", () => {
    expect(formatAmount(5, "??")).toBe("5.00 ??");
  });
});

describe("formatDiscount", () => {
  it("shows the percentage of a discounted line", () => {
    expect(formatDiscount(20)).toBe("20%");
    expect(formatDiscount(12.5)).toBe("12.5%");
  });

  it("shows a dash when a line has no discount", () => {
    expect(formatDiscount(0)).toBe("—");
  });
});

describe("formatInvoiceDate", () => {
  it("writes the month in words", () => {
    expect(formatInvoiceDate("2026-11-24T12:00:00Z")).toMatch(/^November 2[34], 2026$/);
  });
});

describe("firstName", () => {
  it("takes the first word of the name", () => {
    expect(firstName("Jamie Taylor")).toBe("Jamie");
    expect(firstName("  Jamie  ")).toBe("Jamie");
  });
});

describe("addressLines", () => {
  it("adds the postal code and city on a second line", () => {
    expect(addressLines("45 Harbour Road", "34000", "Istanbul")).toEqual([
      "45 Harbour Road",
      "34000 Istanbul",
    ]);
  });

  it("keeps just the street when the order saved no city or postal code", () => {
    expect(addressLines("45 Harbour Road", null, null)).toEqual(["45 Harbour Road"]);
  });
});
