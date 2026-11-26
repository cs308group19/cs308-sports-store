import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../auth/types";
import { initialsOf, profileDetails } from "./profileDetails";

const customer = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  id: "c1",
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  homeAddress: "Orta Mah. 12, Tuzla, Istanbul",
  role: "Customer",
  ...overrides,
});

/** SCRUM-43/65. The profile page shows the signed-in customer's own data, never sample data. */
describe("profileDetails", () => {
  it("shows the name, email and address of the signed-in customer", () => {
    expect(profileDetails(customer())).toEqual({
      initials: "AY",
      name: "Ayşe Yılmaz",
      email: "ayse@example.com",
      address: "Orta Mah. 12, Tuzla, Istanbul",
    });
  });

  it("shows each account its own data", () => {
    const first = profileDetails(customer());
    const second = profileDetails(
      customer({ id: "c2", name: "Mert Kaya", email: "mert@example.com", homeAddress: "Moda, Kadıköy" }),
    );
    expect(second).toEqual({
      initials: "MK",
      name: "Mert Kaya",
      email: "mert@example.com",
      address: "Moda, Kadıköy",
    });
    expect(second).not.toEqual(first);
  });

  it("never falls back to the old sample customer", () => {
    const details = profileDetails(customer({ homeAddress: null }));
    expect(JSON.stringify(details)).not.toMatch(/Jamie|Taylor|TR-308|Fast Lane/);
  });

  it.each([null, "", "   "])("says there is no address when it is %j", (homeAddress) => {
    expect(profileDetails(customer({ homeAddress })).address).toBe("No home address on file");
  });

  it("does not expose the tax ID or a password", () => {
    expect(Object.keys(profileDetails(customer())).sort()).toEqual([
      "address",
      "email",
      "initials",
      "name",
    ]);
  });
});

describe("initialsOf", () => {
  it.each([
    ["Jamie Taylor", "JT"],
    ["Ali Can Demir", "AD"],
    ["Cher", "C"],
    ["  ilker   ışık ", "İI"],
  ])("%j -> %s", (name, initials) => {
    expect(initialsOf(name, "x@example.com")).toBe(initials);
  });

  it("uses the email when the name is empty", () => {
    expect(initialsOf("  ", "mert@example.com")).toBe("M");
    expect(initialsOf("  ", "  mert@example.com")).toBe("M");
    expect(initialsOf("  ", "   ")).toBe("?");
  });
});
