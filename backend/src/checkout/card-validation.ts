const expiryMonth = new Intl.DateTimeFormat('en-GB', {
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});

export function isCardNumber(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{13,19}$/.test(value)) return false;

  let sum = 0;
  for (let index = value.length - 1; index >= 0; index--) {
    const digit = Number(value[index]);
    const doubled = (value.length - index) % 2 === 0 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum % 10 === 0;
}

export function isCardExpiry(value: unknown, now = new Date()): boolean {
  if (typeof value !== 'string' || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) {
    return false;
  }

  const [month, year] = value.split('/').map(Number);
  const [currentMonth, currentYear] = expiryMonth
    .format(now)
    .split('/')
    .map(Number);
  return (2000 + year) * 12 + month >= currentYear * 12 + currentMonth;
}
