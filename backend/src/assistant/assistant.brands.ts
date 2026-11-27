/**
 * The brands the shop sells. Products have no brand column, so it is read from the start of the
 * name. Keep in step with frontend/src/utils/brands.ts.
 */
export const BRANDS = [
  'Nike',
  'Adidas',
  'Puma',
  'Vans',
  'Spalding',
  'Converse',
  'ASICS',
  'New Balance',
  'Wilson',
  'REP Fitness',
] as const;

export type Brand = (typeof BRANDS)[number];

/** The brand a product name starts with, or null for unbranded products. */
export function brandOf(name: string): Brand | null {
  const lower = name.trim().toLowerCase();
  return (
    BRANDS.find((brand) => `${lower} `.startsWith(`${brand.toLowerCase()} `)) ??
    null
  );
}
