import type { RequiredEnvName } from "./env";

/**
 * SCRUM-67. Shown instead of the store when frontend/.env is missing settings. It must not import
 * anything that reads those settings (lib/supabase, App), or it would fail the same way.
 */
export function SetupMessage({ missing }: { missing: RequiredEnvName[] }) {
  return (
    <main className="setup-message" role="alert">
      <h1>The store is not set up yet</h1>
      <p>
        {missing.length === 1 ? "This setting is" : "These settings are"} missing from{" "}
        <code>frontend/.env</code>:
      </p>
      <ul>
        {missing.map((name) => (
          <li key={name}>
            <code>{name}</code>
          </li>
        ))}
      </ul>
      <p>
        Copy <code>frontend/.env.example</code> to <code>frontend/.env</code>, fill in the values
        from the Supabase dashboard (Project Settings → API), then restart <code>npm run dev</code>.
      </p>
    </main>
  );
}
