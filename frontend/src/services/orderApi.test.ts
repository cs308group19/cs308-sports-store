import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-27. The order history page loads the signed-in customer's orders and shows each status. */
const apiFetch = vi.fn();

vi.mock("../lib/api", () => ({
  apiFetch,
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("./cataloguePhoto", () => ({
  cataloguePhoto: (model: string) => `/catalogue/${model}.webp`,
}));

const { fetchOrderHistory, orderErrorMessage, orderLineImage, trackerStep } = await import(
  "./orderApi"
);

describe("orderApi", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("asks the API for the signed-in customer's orders", async () => {
    apiFetch.mockResolvedValue([]);
    await expect(fetchOrderHistory()).resolves.toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/me/orders");
  });

  it.each([
    ["processing", "Processing"],
    ["in_transit", "In transit"],
    ["delivered", "Delivered"],
  ] as const)("shows %s as the %s step", (status, step) => {
    expect(trackerStep(status)).toBe(step);
  });

  it("has no tracker step for a cancelled order", () => {
    expect(trackerStep("cancelled")).toBeNull();
  });

  it("shows the API's message when the server refuses the request", async () => {
    const { ApiError } = await import("../lib/api");
    expect(orderErrorMessage(new ApiError(401, "Please sign in again."))).toBe(
      "Please sign in again.",
    );
  });

  it("shows a general message for anything else", () => {
    expect(orderErrorMessage(new Error("boom"))).toBe(
      "Something went wrong while loading your orders. Please try again.",
    );
  });

  describe("orderLineImage", () => {
    it("uses the uploaded product photo when there is one", () => {
      expect(orderLineImage({ imageUrl: "/uploads/p.webp", model: "AS-PRO-25" })).toBe(
        "/uploads/p.webp",
      );
    });

    it("falls back to the catalogue photo of the model for seeded products", () => {
      expect(orderLineImage({ imageUrl: null, model: "AS-PRO-25" })).toBe(
        "/catalogue/AS-PRO-25.webp",
      );
      expect(orderLineImage({ imageUrl: "   ", model: "AS-PRO-25" })).toBe(
        "/catalogue/AS-PRO-25.webp",
      );
    });

    it("shows the placeholder when there is neither a photo nor a model", () => {
      expect(orderLineImage({ imageUrl: null, model: null })).toBe("/images/photo-unavailable.svg");
    });
  });
});
