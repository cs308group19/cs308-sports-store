/** Accounts are stored with a trimmed, lowercase email (backend RegisterDto does the same). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The message the login form shows when Supabase refuses a sign-in. A wrong email and a wrong
 * password get the same message, so the form never reveals which emails have an account.
 */
export function signInErrorMessage(error: { code?: string; message: string }): string {
  return error.code === "invalid_credentials" ? "Wrong email or password." : error.message;
}
