import type { Role } from "../types/models";

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
}

export const demoAccounts: Array<SessionUser & { password: string }> = [
  { name: "Jamie Taylor", email: "jamie@rally.store", password: "rally123", role: "Customer" },
  {
    name: "Priya Product",
    email: "product@rally.store",
    password: "staff123",
    role: "Product Manager",
  },
  {
    name: "Sam Sales",
    email: "sales@rally.store",
    password: "staff123",
    role: "Sales Manager",
  },
  {
    name: "Alex Support",
    email: "support@rally.store",
    password: "staff123",
    role: "Support Agent",
  },
];
