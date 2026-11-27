import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("../lib/api", () => ({ apiFetch, ApiError: class extends Error {} }));

import { fetchPendingReviews, moderateReview, submitReview } from "./reviewApi";

describe("review API requests", () => {
  beforeEach(() => apiFetch.mockReset());

  it("sends the exact delivered item ID and an optional comment", async () => {
    apiFetch.mockResolvedValue({ id: 1, rating: 5, commentStatus: "pending" });
    await submitReview("9223372036854775807", 5, "Great fit");
    expect(apiFetch).toHaveBeenCalledWith("/me/reviews", {
      method: "POST",
      body: { orderItemId: "9223372036854775807", rating: 5, comment: "Great fit" },
    });
  });

  it("loads pending comments and sends the manager's decision", async () => {
    await fetchPendingReviews();
    await moderateReview("9223372036854775807", "rejected");
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/staff/reviews?status=pending");
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/staff/reviews/9223372036854775807", {
      method: "PATCH",
      body: { status: "rejected" },
    });
  });
});
