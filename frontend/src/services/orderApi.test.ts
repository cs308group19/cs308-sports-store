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

const { fetchOrderHistory, orderErrorMessage, trackerStep } = await import("./orderApi");

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
});
