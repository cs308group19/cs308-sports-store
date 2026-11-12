import { UserRole } from '../auth/roles.js';

export interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  taxId?: string;
  homeAddress?: string;
}

/** One demo account per role. These credentials are public on purpose (shown on the login page). */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: 'jamie@rally.store',
    password: 'Rally1234',
    fullName: 'Jamie Taylor',
    role: UserRole.customer,
    taxId: 'TR-308-58-991',
    homeAddress: '123 Fast Lane, Kadıköy, Istanbul 34000',
  },
  {
    email: 'product@rally.store',
    password: 'Staff1234',
    fullName: 'Priya Product',
    role: UserRole.product_manager,
  },
  {
    email: 'sales@rally.store',
    password: 'Staff1234',
    fullName: 'Sam Sales',
    role: UserRole.sales_manager,
  },
  {
    email: 'support@rally.store',
    password: 'Staff1234',
    fullName: 'Alex Support',
    role: UserRole.support_agent,
  },
];
