/** An amount in the invoice's own currency, e.g. "$236.52". */
export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    // An unknown currency code: show the number with the code instead of failing the page.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** The discount of a line as shown in the items table: "20%", or a dash when there is none. */
export function formatDiscount(rate: number): string {
  return rate > 0 ? `${Number(rate.toFixed(2))}%` : "—";
}

/** "November 24, 2026", in the store's time zone, so the page shows the same date as the PDF. */
export function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Istanbul",
  });
}

/** The first word of the billed-to name, for the greeting. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** The delivery address on one block: street, then postal code and city when there are any. */
export function addressLines(address: string, postalCode: string | null, city: string | null) {
  const place = [postalCode, city].filter(Boolean).join(" ");
  return place ? [address, place] : [address];
}
