import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-25. The invoice page loads the invoice of the signed-in customer from the API. */
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

const { fetchInvoice, invoiceErrorMessage, isInvoiceNotFound } = await import("./invoiceApi");
const { ApiError } = await import("../lib/api");

beforeEach(() => {
  apiFetch.mockReset();
});

describe("fetchInvoice", () => {
  it("asks for the invoice by the id from the checkout response", async () => {
    apiFetch.mockResolvedValue({ id: "7", invoiceNumber: "INV-2026-000007" });
    await expect(fetchInvoice("7")).resolves.toMatchObject({ invoiceNumber: "INV-2026-000007" });
    expect(apiFetch).toHaveBeenCalledWith("/me/invoices/7");
  });

  it("keeps a path-like id inside the invoice URL", async () => {
    apiFetch.mockResolvedValue({});
    await fetchInvoice("7/pdf");
    expect(apiFetch).toHaveBeenCalledWith("/me/invoices/7%2Fpdf");
  });
});

describe("invoice errors", () => {
  it("treats a 404 as not found, whoever owns the invoice", () => {
    expect(isInvoiceNotFound(new ApiError(404, "Invoice not found."))).toBe(true);
  });

  it("does not treat other failures as not found", () => {
    expect(isInvoiceNotFound(new ApiError(500, "Boom"))).toBe(false);
    expect(isInvoiceNotFound(new ApiError(401, "Unauthorized"))).toBe(false);
    expect(isInvoiceNotFound(new Error("network"))).toBe(false);
  });

  it("shows the API message, or a plain one for an unknown failure", () => {
    expect(invoiceErrorMessage(new ApiError(0, "Cannot reach the server."))).toBe(
      "Cannot reach the server.",
    );
    expect(invoiceErrorMessage(new Error("x"))).toMatch(/try again/i);
  });
});
