import type { Product } from "../types/models";

/** The brands the shop sells. The API has no brand field, so it is read from the product name. */
export const BRANDS = [
  "Nike",
  "Adidas",
  "Puma",
  "Vans",
  "Spalding",
  "Converse",
  "ASICS",
  "New Balance",
  "Wilson",
  "REP Fitness",
] as const;

export type Brand = (typeof BRANDS)[number];

/** The brand a product name starts with, or null for unbranded products. */
export function brandOf(name: string): Brand | null {
  const lower = name.trim().toLowerCase();
  return BRANDS.find((brand) => `${lower} `.startsWith(`${brand.toLowerCase()} `)) ?? null;
}

export interface BrandSummary {
  name: Brand;
  products: Product[];
}

/** Every brand present in the list, the one with the most products first. */
export function brandSummaries(products: readonly Product[]): BrandSummary[] {
  return BRANDS.map((name) => ({ name, products: products.filter((p) => brandOf(p.name) === name) }))
    .filter((summary) => summary.products.length > 0)
    .sort((a, b) => b.products.length - a.products.length);
}
