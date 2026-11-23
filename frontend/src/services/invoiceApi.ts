import { ApiError, apiFetch, apiFetchFile } from "../lib/api";
import type { InvoiceView } from "../types/invoice";

/** Loads one of the signed-in customer's invoices. Another customer's invoice is a 404. */
export function fetchInvoice(invoiceId: string): Promise<InvoiceView> {
  return apiFetch<InvoiceView>(`/me/invoices/${encodeURIComponent(invoiceId)}`);
}

/**
 * Downloads the invoice as a PDF. The file name comes from the server; `fallbackName` is used
 * when the browser is not allowed to read it.
 */
export async function fetchInvoicePdf(
  invoiceId: string,
  fallbackName: string,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await apiFetchFile(`/me/invoices/${encodeURIComponent(invoiceId)}/pdf`);
  return { blob, filename: filename ?? fallbackName };
}

/** True when the API answered 404: the invoice does not exist or belongs to someone else. */
export function isInvoiceNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function invoiceErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong while loading your invoice. Please try again.";
}
