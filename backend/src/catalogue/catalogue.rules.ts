/** Product fields required by the course brief (ID is assigned by the database). */
export interface ProductInput {
  name: string;
  model: string;
  serialNumber: string;
  description: string;
  stock: number;
  price: number;
  warrantyStatus: string;
  distributor: string;
}

const REQUIRED_TEXT_FIELDS = [
  ['name', 'Name'],
  ['model', 'Model'],
  ['serialNumber', 'Serial number'],
  ['description', 'Description'],
  ['warrantyStatus', 'Warranty status'],
  ['distributor', 'Distributor'],
] as const;

/** Returns every problem with a product, or an empty list when it is valid. */
export function validateProduct(input: Partial<ProductInput>): string[] {
  const errors: string[] = [];

  for (const [field, label] of REQUIRED_TEXT_FIELDS) {
    const value = input[field];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${label} is required.`);
    }
  }

  if (!isValidPrice(input.price)) {
    errors.push('Price must be a number with at most two decimals and no negative value.');
  }

  if (!isValidStock(input.stock)) {
    errors.push('Stock must be a whole number, zero or more.');
  }

  return errors;
}

/** Prices are money: non-negative and at most two decimal places. */
export function isValidPrice(price: unknown): price is number {
  return (
    typeof price === 'number' &&
    Number.isFinite(price) &&
    price >= 0 &&
    Math.round(price * 100) / 100 === price
  );
}

export function isValidStock(stock: unknown): stock is number {
  return typeof stock === 'number' && Number.isInteger(stock) && stock >= 0;
}

/** Out-of-stock products stay searchable but cannot be added to the cart. */
export function isInStock(stock: number): boolean {
  return stock > 0;
}

/** Collapses spaces and trims a category name so "  Gym   Gear " and "Gym Gear" are the same. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateCategoryName(name: string): string | null {
  const normalized = normalizeCategoryName(name);
  if (normalized.length < 2) {
    return 'Category name must be at least 2 characters.';
  }
  if (normalized.length > 50) {
    return 'Category name must be at most 50 characters.';
  }
  return null;
}

/** Category names are unique regardless of letter case. */
export function isDuplicateCategory(
  existingNames: readonly string[],
  candidate: string,
): boolean {
  const wanted = normalizeCategoryName(candidate).toLocaleLowerCase('en-US');
  return existingNames.some(
    (name) => normalizeCategoryName(name).toLocaleLowerCase('en-US') === wanted,
  );
}
