import type { Role } from "../types/models";
import type { ApiRole } from "./types";

const labels: Record<ApiRole, Role> = {
  customer: "Customer",
  product_manager: "Product Manager",
  sales_manager: "Sales Manager",
  support_agent: "Support Agent",
};

/**
 * A role this build does not know yet (for example a backend deployed before the frontend) falls
 * back to the customer view. That only affects what the UI shows: the backend checks the real role
 * on every request.
 */
export function roleFromApi(role: ApiRole): Role {
  if (Object.prototype.hasOwnProperty.call(labels, role)) return labels[role];
  console.warn(`Unknown role "${role}" from the API; showing the customer view.`);
  return "Customer";
}
