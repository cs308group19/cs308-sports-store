import { describe, expect, it } from "vitest";
import { checkoutValidationError } from "./checkoutValidation";

const now = new Date("2026-12-31T21:00:00Z");
const input = {
  deliveryRecipient: "Deniz Yılmaz",
  deliveryAddress: "Test address, Istanbul",
  cardholderName: "Deniz Yılmaz",
  cardNumber: "4242 4242 4242 4242",
  expiry: "01/27",
  cvv: "973",
};

describe("checkout form validation", () => {
  it("accepts a formatted demo card and a current expiry month", () => {
    expect(checkoutValidationError(input, now)).toBeNull();
    expect(checkoutValidationError({ ...input, cvv: "9731" }, now)).toBeNull();
  });

  it.each([
    { deliveryRecipient: "" },
    { deliveryAddress: "" },
    { cardholderName: "4242" },
    { cardNumber: "4242 4242 4242 4243" },
    { expiry: "13/27" },
    { expiry: "12/26" },
    { cvv: "97310" },
  ])("shows an error for %o", (invalid) => {
    expect(checkoutValidationError({ ...input, ...invalid }, now)).toBeTruthy();
  });
});
