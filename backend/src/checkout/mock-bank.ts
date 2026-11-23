export function authorizeMockPayment(cardNumber: string) {
  if (cardNumber !== '4242424242424242') return null;
  return { cardBrand: 'Visa', cardLast4: cardNumber.slice(-4) };
}
