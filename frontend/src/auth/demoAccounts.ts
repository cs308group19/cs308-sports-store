import type { Role } from "../types/models";

/**
 * Display-only list for the login page. The accounts themselves live in Supabase
 * (created by `npm run seed:demo` in the backend); nothing here is used to authenticate.
 */
export const demoAccounts: Array<{ role: Role; email: string; password: string }> = [
  { role: "Customer", email: "jamie@rally.store", password: "Rally1234" },
  { role: "Product Manager", email: "product@rally.store", password: "Staff1234" },
  { role: "Sales Manager", email: "sales@rally.store", password: "Staff1234" },
  { role: "Support Agent", email: "support@rally.store", password: "Staff1234" },
];
