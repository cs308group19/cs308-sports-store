/** Formatting for the card fields and the card picture on the checkout page. */

/** The longest card number the checkout accepts (utils/checkoutValidation.ts). */
export const MAX_CARD_DIGITS = 19;

/** Just the digits of a card number, which is what the checkout API receives. */
export function cardDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_CARD_DIGITS);
}

/** "4242424242424242" becomes "4242 4242 4242 4242". */
export function formatCardNumber(value: string): string {
  return cardDigits(value).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export type CardBrand = "Visa" | "Mastercard" | "Amex" | "Card";

export function cardBrand(value: string): CardBrand {
  const digits = cardDigits(value);
  if (digits.startsWith("4")) return "Visa";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  // Mastercard's second range, 2221 to 2720, is only known after four digits.
  const first = Number(digits.slice(0, 4));
  if (digits.length >= 4 && first >= 2221 && first <= 2720) return "Mastercard";
  return "Card";
}

/** Keeps an expiry date in MM/YY form, adding the slash while it is typed. */
export function formatExpiry(value: string): string {
  // "1/" means January, typed with its own slash.
  const padded = /^\d\//.test(value) ? `0${value}` : value;
  const digits = padded.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** The number printed on the card picture: what was typed, with dots for the rest. */
export function maskedCardNumber(value: string): string {
  return cardDigits(value).padEnd(16, "•").replace(/(.{4})(?=.)/g, "$1 ");
}
