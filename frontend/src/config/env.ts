/** Settings the app cannot start without (see frontend/.env.example). */
export const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

export type RequiredEnvName = (typeof REQUIRED_ENV)[number];

/** Values from .env.example that only show where the real setting goes. */
const PLACEHOLDERS: Record<RequiredEnvName, RegExp> = {
  VITE_SUPABASE_URL: /<project-ref>/,
  VITE_SUPABASE_PUBLISHABLE_KEY: /replace_me/,
};

/**
 * SCRUM-67. Names every required setting that is missing, empty or still the example value.
 * Checked in main.tsx before React starts, so a bad .env shows a message instead of a blank page.
 */
export function missingEnv(env: Partial<Record<string, unknown>>): RequiredEnvName[] {
  return REQUIRED_ENV.filter((name) => {
    const value = env[name];
    if (typeof value !== "string" || value.trim() === "") return true;
    return PLACEHOLDERS[name].test(value);
  });
}
