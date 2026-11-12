import type { Role } from "../types/models";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Role values exactly as the backend sends them. */
export type ApiRole = "customer" | "product_manager" | "sales_manager" | "support_agent";

export interface RegisterInput {
  fullName: string;
  taxId: string;
  email: string;
  homeAddress: string;
  password: string;
}
