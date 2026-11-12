/** bcrypt, which Supabase Auth uses, only reads the first 72 bytes (not characters) of a password. */
const MAX_PASSWORD_BYTES = 72;

/** Mirrors the backend rules (RegisterDto) and the Supabase password policy. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "Password is too long. Use at most 72 characters (letters such as ğ or ş count as two).";
  }
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password needs a number.";
  return null;
}
