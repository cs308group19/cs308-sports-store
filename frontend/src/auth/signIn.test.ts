import { describe, expect, it } from "vitest";
import { normalizeEmail, signInErrorMessage } from "./signIn";

/** SCRUM-62 (login). */
describe("normalizeEmail", () => {
  it("trims and lowercases the email, as registration stored it", () => {
    expect(normalizeEmail("  Alex.Morgan@Example.COM ")).toBe("alex.morgan@example.com");
  });
});

describe("signInErrorMessage", () => {
  it("gives one message for a wrong email or a wrong password", () => {
    expect(
      signInErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
    ).toBe("Wrong email or password.");
  });

  it("passes other Supabase errors through", () => {
    expect(
      signInErrorMessage({ code: "over_request_rate_limit", message: "Too many requests" }),
    ).toBe("Too many requests");
    expect(signInErrorMessage({ message: "Network error" })).toBe("Network error");
  });
});
