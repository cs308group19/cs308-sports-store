import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { roleFromApi } from "./roles";
import type { ApiRole, RegisterInput, SessionUser } from "./types";

interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  role: ApiRole;
}

interface AuthContextValue {
  user: SessionUser | null;
  /** True until the saved session (if any) has been checked. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

/** Registration worked but the automatic sign-in after it did not: the user should log in. */
export class AccountCreatedError extends Error {
  constructor() {
    super("Your account was created, but we could not sign you in. Please log in.");
    this.name = "AccountCreatedError";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<SessionUser> {
  const me = await apiFetch<MeResponse>("/auth/me");
  return { id: me.id, name: me.fullName, email: me.email, role: roleFromApi(me.role) };
}

/**
 * Ends the session in this browser only. The default "global" scope would also sign the user out
 * on every other device. With "local", supabase-js removes the stored session before it calls the
 * server, so a network or server error cannot leave this browser signed in; the error only means
 * the refresh token could not be revoked server side.
 */
async function signOutLocally() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn("Signed out locally, but the server could not revoke the session:", error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Read from the auth listener, which must not depend on React state.
  const userIdRef = useRef<string | null>(null);
  // While signIn runs it loads the profile itself, so the listener leaves its SIGNED_IN alone.
  const signingInRef = useRef(false);

  const applyUser = useCallback((next: SessionUser | null) => {
    userIdRef.current = next?.id ?? null;
    setUser(next);
  }, []);

  // Restore the saved session on page load. The role always comes from the backend.
  useEffect(() => {
    let cancelled = false;

    // Loads the profile for the session that is stored now (another tab may have changed it).
    const syncWithStoredSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUserId = data.session?.user.id ?? null;
      if (cancelled || sessionUserId === userIdRef.current) return;
      if (!sessionUserId) {
        applyUser(null);
        return;
      }
      try {
        const current = await fetchCurrentUser();
        const latest = await supabase.auth.getSession();
        // Ignore the answer if the session changed again while the request was running.
        if (!cancelled && latest.data.session?.user.id === current.id) applyUser(current);
      } catch (error) {
        // A rejected token means the session is dead. If the server is just unreachable, keep it.
        if (error instanceof ApiError && error.status === 401) await signOutLocally();
        if (!cancelled) applyUser(null);
      }
    };

    void syncWithStoredSession().finally(() => {
      if (!cancelled) setLoading(false);
    });

    // Only synchronous work here: calling Supabase from this callback can deadlock, so the
    // profile is loaded in a later task.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || signingInRef.current) return;
      const sessionUserId = session?.user.id ?? null;
      if (sessionUserId === userIdRef.current) return;
      // Someone signed out, or signed in as someone else in another tab. Stop showing the old
      // identity right away, so the UI never runs as a different user than the token in use.
      applyUser(null);
      if (sessionUserId) setTimeout(() => void syncWithStoredSession(), 0);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [applyUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      signingInRef.current = true;
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          throw new Error(
            error.code === "invalid_credentials" ? "Wrong email or password." : error.message,
          );
        }
        try {
          const current = await fetchCurrentUser();
          applyUser(current);
          return current;
        } catch (failure) {
          await signOutLocally();
          applyUser(null);
          throw failure;
        }
      } finally {
        signingInRef.current = false;
      }
    },
    [applyUser],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await apiFetch("/auth/register", { method: "POST", body: input, auth: false });
      try {
        return await signIn(input.email, input.password);
      } catch {
        throw new AccountCreatedError();
      }
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await signOutLocally();
    applyUser(null);
  }, [applyUser]);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signOut }),
    [user, loading, signIn, register, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
