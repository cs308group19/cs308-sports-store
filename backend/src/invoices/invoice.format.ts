/** How the PDF and the email write amounts, dates and addresses. The page does the same in the browser. */

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** A line's discount: "20%", or a dash when there is none. */
export function formatDiscount(rate: number): string {
  return rate > 0 ? `${Number(rate.toFixed(2))}%` : '-';
}

/** "November 24, 2026", in the store's time zone so the PDF never depends on the server's. */
export function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Istanbul',
  });
}

/** Street, then postal code and city on a second line when the order saved them. */
export function addressLines(
  address: string,
  postalCode: string | null,
  city: string | null,
): string[] {
  const place = [postalCode, city].filter(Boolean).join(' ');
  return place ? [address, place] : [address];
}

/** Characters the PDF's built-in Helvetica can draw (Windows-1252): printable ASCII, Latin-1 and a few more. */
const WIN_ANSI_EXTRA = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac,
]);

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(code)
  );
}

/**
 * The built-in PDF fonts cannot draw every Turkish letter (ş, ğ, İ, ı). Those become their plain
 * Latin forms instead of garbage. ü, ö, ç and the rest of Latin-1 are kept as they are.
 */
export function pdfSafe(text: string): string {
  return Array.from(text.normalize('NFC'))
    .map((char) => {
      if (isWinAnsi(char)) return char;
      if (char === 'ı') return 'i';
      const base = char.normalize('NFD').replace(/\p{M}/gu, '');
      return base !== '' && Array.from(base).every(isWinAnsi) ? base : '?';
    })
    .join('');
}
