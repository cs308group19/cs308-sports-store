import { describe, expect, it } from "vitest";
import { cardBrand, cardDigits, formatCardNumber, formatExpiry, maskedCardNumber } from "./cardFormat";
import { checkoutValidationError } from "./checkoutValidation";

describe("formatCardNumber", () => {
  it("groups the digits in fours", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatCardNumber("42424")).toBe("4242 4");
  });

  it("does not leave a trailing space after a full group", () => {
    expect(formatCardNumber("4242 ")).toBe("4242");
  });

  it("stops at the longest number the checkout accepts", () => {
    expect(formatCardNumber("1".repeat(30))).toBe("1111 1111 1111 1111 111");
  });

  it("ignores letters and punctuation", () => {
    expect(formatCardNumber("42a4-2 4x2")).toBe("4242 42");
  });
});

describe("cardDigits", () => {
  it("gives digits only from the formatted field", () => {
    expect(cardDigits("4242 4242 4242 4242")).toBe("4242424242424242");
    expect(cardDigits("4242 4242 4242 4242")).toMatch(/^\d+$/);
  });

  it("sends a number the checkout still accepts", () => {
    const input = {
      deliveryRecipient: "Test Customer",
      deliveryAddress: "1 Test Street, Istanbul",
      cardholderName: "Test Customer",
      cardNumber: cardDigits(formatCardNumber("4242424242424242")),
      expiry: "12/30",
      cvv: "123",
    };
    expect(checkoutValidationError(input, new Date("2026-11-27T12:00:00Z"))).toBeNull();
  });
});

describe("cardBrand", () => {
  it("recognises Visa", () => {
    expect(cardBrand("4242 4242")).toBe("Visa");
  });

  it("recognises both Mastercard ranges", () => {
    for (const number of ["51", "55", "2221", "2720"]) expect(cardBrand(number)).toBe("Mastercard");
  });

  it("recognises American Express", () => {
    expect(cardBrand("34")).toBe("Amex");
    expect(cardBrand("3782 8224")).toBe("Amex");
  });

  it("calls everything else a card", () => {
    for (const number of ["", "50", "56", "2220", "2721", "222", "36", "6011"]) {
      expect(cardBrand(number)).toBe("Card");
    }
  });
});

describe("formatExpiry", () => {
  it("adds the slash after the month", () => {
    expect(formatExpiry("1228")).toBe("12/28");
    expect(formatExpiry("122")).toBe("12/2");
    expect(formatExpiry("12")).toBe("12");
  });

  it("pads a one-digit month typed with a slash", () => {
    expect(formatExpiry("1/30")).toBe("01/30");
  });

  it("keeps at most four digits", () => {
    expect(formatExpiry("12/2830")).toBe("12/28");
  });
});

describe("maskedCardNumber", () => {
  it("shows dots for the digits not typed yet", () => {
    expect(maskedCardNumber("")).toBe("•••• •••• •••• ••••");
    expect(maskedCardNumber("4242 42")).toBe("4242 42•• •••• ••••");
  });

  it("shows longer numbers in full", () => {
    expect(maskedCardNumber("4".repeat(19))).toBe("4444 4444 4444 4444 444");
  });
});
