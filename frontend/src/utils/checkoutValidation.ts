import type { CheckoutInput } from "../services/checkoutApi";

const expiryMonth = new Intl.DateTimeFormat("en-GB", {
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function validCardNumber(value: string): boolean {
  const digits = value.replace(/[ -]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  for (let index = digits.length - 1; index >= 0; index--) {
    const digit = Number(digits[index]);
    const doubled = (digits.length - index) % 2 === 0 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum % 10 === 0;
}

function validExpiry(value: string, now: Date): boolean {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;

  const [month, year] = value.split("/").map(Number);
  const [currentMonth, currentYear] = expiryMonth.format(now).split("/").map(Number);
  return (2000 + year) * 12 + month >= currentYear * 12 + currentMonth;
}

export function checkoutValidationError(input: CheckoutInput, now = new Date()): string | null {
  if (!input.deliveryRecipient || input.deliveryRecipient.length > 120) {
    return "Enter the delivery recipient's name.";
  }
  if (input.deliveryAddress.length < 5 || input.deliveryAddress.length > 500) {
    return "Enter the full delivery address.";
  }
  if (!/\p{L}/u.test(input.cardholderName) || input.cardholderName.length > 120) {
    return "Enter the name on the card.";
  }
  if (!validCardNumber(input.cardNumber)) return "Enter a valid card number.";
  if (!validExpiry(input.expiry, now)) {
    return "Enter an expiry month in MM/YY format that has not passed.";
  }
  if (!/^\d{3,4}$/.test(input.cvv)) return "Enter a 3- or 4-digit security code.";
  return null;
}
