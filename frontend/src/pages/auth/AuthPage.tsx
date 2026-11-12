import { useState, type FormEvent } from "react";
import { demoAccounts } from "../../auth/demoAccounts";
import { passwordProblem } from "../../auth/passwordPolicy";
import type { SessionUser } from "../../auth/types";
import { AccountCreatedError, useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ApiError } from "../../lib/api";

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "An account with this email already exists.";
    if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthPage({
  onAuthenticated,
  onCancel,
}: {
  onAuthenticated: (account: SessionUser) => void;
  onCancel: () => void;
}) {
  const { signIn, register } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const switchTab = (next: "login" | "signup") => {
    setTab(next);
    setError("");
  };

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      onAuthenticated(await signIn(String(data.get("email")), String(data.get("password"))));
    } catch (failure) {
      setError(describeError(failure));
      setSubmitting(false);
    }
  };

  const signup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== data.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const account = await register({
        fullName: String(data.get("fullName")),
        taxId: String(data.get("taxId")),
        email: String(data.get("email")),
        homeAddress: String(data.get("address")),
        password,
      });
      onAuthenticated(account);
    } catch (failure) {
      // The account exists now, so submitting the signup form again would only answer 409.
      if (failure instanceof AccountCreatedError) setTab("login");
      setError(describeError(failure));
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <button className="auth-brand" onClick={onCancel}>
          <span className="brand-mark">R</span>
          <span className="brand-lockup">
            <b>RALLY</b>
            <small>Play it your way</small>
          </span>
        </button>
        <h2>
          Every goal starts
          <br />
          with showing up.
        </h2>
        <p>Your cart is waiting. Sign in without losing your picks.</p>
      </div>
      <div className="auth-panel">
        <button className="auth-close" onClick={onCancel}>
          ← Back to store
        </button>
        <div className="auth-tabs" role="tablist" aria-label="Authentication">
          <button className={tab === "login" ? "active" : ""} onClick={() => switchTab("login")}>
            Log in
          </button>
          <button className={tab === "signup" ? "active" : ""} onClick={() => switchTab("signup")}>
            Sign up
          </button>
        </div>

        {tab === "login" ? (
          <form className="form-card auth-form" onSubmit={login}>
            <span className="eyebrow">Member access</span>
            <h1>Welcome back</h1>
            <p>
              Log in to check out, track orders, and manage your RALLY account. Store team members
              are taken to their dashboard.
            </p>
            <label>
              Email
              <input name="email" required type="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </span>
            </label>
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>
            <div className="form-switch">
              New to RALLY?{" "}
              <button type="button" onClick={() => switchTab("signup")}>
                Sign up
              </button>
            </div>
          </form>
        ) : (
          <form className="form-card auth-form" onSubmit={signup}>
            <span className="eyebrow">Start your journey</span>
            <h1>Create account</h1>
            <p>
              Everyone starts as a customer. Store team roles are assigned by an administrator after
              sign-up.
            </p>
            <label>
              Full name
              <input name="fullName" required maxLength={120} placeholder="Alex Morgan" />
            </label>
            <label>
              Tax ID
              <input
                name="taxId"
                required
                minLength={5}
                maxLength={32}
                placeholder="Tax identification number"
              />
            </label>
            <label>
              Email
              <input name="email" required type="email" placeholder="alex@example.com" />
            </label>
            <label>
              Home address
              <textarea
                name="address"
                required
                minLength={5}
                maxLength={500}
                placeholder="Street, city, postal code"
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </span>
            </label>
            <small className="password-hint">
              Use 8+ characters with at least one lowercase letter, one uppercase letter and one
              number.
            </small>
            <label>
              Confirm password
              <input
                name="confirmPassword"
                required
                type={showPassword ? "text" : "password"}
                placeholder="Repeat your password"
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <div className="form-switch">
              Already have an account?{" "}
              <button type="button" onClick={() => switchTab("login")}>
                Log in
              </button>
            </div>
          </form>
        )}

        <div className="demo-accounts">
          <b>Demo accounts</b>
          {demoAccounts.map((account) => (
            <span key={account.email}>
              {account.role}: {account.email} / {account.password}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
