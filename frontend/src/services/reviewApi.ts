import { ApiError, apiFetch } from "../lib/api";
import type { CommentStatus, OrderHistoryLine } from "../types/orderHistory";

interface SubmittedReview {
  id: number | string;
  rating: number;
  commentStatus: CommentStatus | null;
}

export function submitReview(
  orderItemId: OrderHistoryLine["id"],
  rating: number,
  comment?: string,
): Promise<SubmittedReview> {
  return apiFetch<SubmittedReview>("/me/reviews", {
    method: "POST",
    body: { orderItemId: String(orderItemId), rating, comment },
  });
}

export function reviewErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Could not reach reviews. Please try again.";
}
