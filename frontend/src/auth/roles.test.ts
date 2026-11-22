import { describe, expect, it, vi } from "vitest";
import { roleFromApi } from "./roles";
import type { ApiRole } from "./types";

/** SCRUM-62 (login). After login the role from GET /api/auth/me picks the screens to show. */
describe("roleFromApi", () => {
  it.each([
    ["customer", "Customer"],
    ["product_manager", "Product Manager"],
    ["sales_manager", "Sales Manager"],
    ["support_agent", "Support Agent"],
  ] as const)("maps %s to %s", (apiRole, label) => {
    expect(roleFromApi(apiRole)).toBe(label);
  });

  it("falls back to the customer view for a role this build does not know", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(roleFromApi("admin" as ApiRole)).toBe("Customer");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not treat Object.prototype keys as roles", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(roleFromApi("toString" as ApiRole)).toBe("Customer");
    expect(roleFromApi("__proto__" as ApiRole)).toBe("Customer");
  });
});
