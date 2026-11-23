import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-34. Which endpoints the Deliveries page calls and what an error says. */
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

const { deliveryErrorMessage, fetchDeliveries, updateDeliveryStatus } = await import("./deliveryApi");
const { ApiError } = await import("../lib/api");

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue([]);
});

describe("deliveries API", () => {
  it("loads the list from /staff/deliveries", async () => {
    await expect(fetchDeliveries()).resolves.toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/staff/deliveries");
  });

  it("sends the new status with PATCH to the delivery's own path", async () => {
    await updateDeliveryStatus(12, "in_transit");
    expect(apiFetch).toHaveBeenCalledWith("/staff/deliveries/12", {
      method: "PATCH",
      body: { status: "in_transit" },
    });
  });

  it("keeps a large delivery id exact", async () => {
    await updateDeliveryStatus("9007199254740993", "delivered");
    expect(apiFetch).toHaveBeenCalledWith("/staff/deliveries/9007199254740993", {
      method: "PATCH",
      body: { status: "delivered" },
    });
  });
});

describe("deliveryErrorMessage", () => {
  it("shows the server's message", () => {
    const error = new ApiError(409, "A delivery cannot go back from delivered to in transit.");
    expect(deliveryErrorMessage(error)).toBe("A delivery cannot go back from delivered to in transit.");
  });

  it("falls back to a generic message for anything else", () => {
    expect(deliveryErrorMessage(new Error("boom"))).toMatch(/Something went wrong/);
  });
});
