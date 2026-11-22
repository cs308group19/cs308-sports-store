import { describe, expect, it } from "vitest";
import { passwordProblem } from "./passwordPolicy";

/** SCRUM-62 (login). The registration form checks the password before calling the API. */
describe("passwordProblem", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordProblem("Rally1234")).toBeNull();
  });

  it.each([
    ["Ra1", "at least 8 characters"],
    ["rally1234", "uppercase letter"],
    ["RALLY1234", "lowercase letter"],
    ["RallyRally", "number"],
  ])("rejects %j: needs %s", (password, problem) => {
    expect(passwordProblem(password)).toContain(problem);
  });

  it("accepts exactly 8 characters", () => {
    expect(passwordProblem("Rally123")).toBeNull();
  });

  it("counts bytes, not characters, against the 72-byte bcrypt limit", () => {
    const seventyTwoBytes = `Aa1${"x".repeat(69)}`;
    expect(passwordProblem(seventyTwoBytes)).toBeNull();
    expect(passwordProblem(`${seventyTwoBytes}x`)).toContain("too long");
    // "ş" is two bytes: "Aa1" + 34 × "ş" + "x" is 3 + 68 + 1 = 72 bytes in only 38 characters.
    expect(passwordProblem(`Aa1${"ş".repeat(34)}x`)).toBeNull();
    expect(passwordProblem(`Aa1${"ş".repeat(34)}xx`)).toContain("too long");
  });
});
