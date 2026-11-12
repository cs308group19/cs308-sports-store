import type { Role } from "../types/models";

export type View =
  | "home"
  | "shop"
  | "product"
  | "cart"
  | "login"
  | "checkout"
  | "invoice"
  | "orders"
  | "wishlist"
  | "profile"
  | "review"
  | "pm-products"
  | "pm-deliveries"
  | "pm-invoices"
  | "pm-reviews"
  | "sales-pricing"
  | "sales-invoices"
  | "sales-analytics"
  | "sales-refunds"
  | "support";

export const roleDefaults: Record<Role, View> = {
  Customer: "home",
  "Product Manager": "pm-products",
  "Sales Manager": "sales-analytics",
  "Support Agent": "support",
};

export const roleNav: Record<Role, Array<[string, View]>> = {
  Customer: [
    ["Home", "home"],
    ["Shop", "shop"],
    ["Orders", "orders"],
    ["Wishlist", "wishlist"],
  ],
  "Product Manager": [
    ["Products", "pm-products"],
    ["Deliveries", "pm-deliveries"],
    ["Invoices", "pm-invoices"],
    ["Review queue", "pm-reviews"],
  ],
  "Sales Manager": [
    ["Overview", "sales-analytics"],
    ["Pricing", "sales-pricing"],
    ["Invoices", "sales-invoices"],
    ["Refunds", "sales-refunds"],
  ],
  "Support Agent": [["Support desk", "support"]],
};

export const staffViews = new Set<View>([
  "pm-products",
  "pm-deliveries",
  "pm-invoices",
  "pm-reviews",
  "sales-pricing",
  "sales-invoices",
  "sales-analytics",
  "sales-refunds",
  "support",
]);
