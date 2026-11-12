import { useState, type FormEvent } from "react";
import { type SessionUser, demoAccounts } from "../../auth/demoAccounts";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";

export function AuthPage({
  onAuthenticated,
  onCancel,
}: {
  onAuthenticated: (account: SessionUser) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [staffError, setStaffError] = useState("");

  const customerLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const account = demoAccounts.find(
      (item) =>
        item.role === "Customer" &&
        item.email === String(data.get("email")).trim().toLowerCase() &&
        item.password === data.get("password"),
    );
    if (!account) {
      setError("Wrong email or password.");
      return;
    }
    setError("");
    onAuthenticated(account);
  };

  const signup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password does not meet the rules below.");
      return;
    }
    if (password !== data.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    onAuthenticated({
      name: String(data.get("fullName")),
      email: String(data.get("email")),
      role: "Customer",
    });
  };

  const staffLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const account = demoAccounts.find(
      (item) =>
        item.role !== "Customer" &&
        item.email === String(data.get("staffEmail")).trim().toLowerCase() &&
        item.password === data.get("staffPassword"),
    );
    if (!account) {
      setStaffError("Wrong staff email or password.");
      return;
    }
    setStaffError("");
    onAuthenticated(account);
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
          <button
            className={tab === "login" ? "active" : ""}
            onClick={() => {
              setTab("login");
              setError("");
            }}
          >
            Log in
          </button>
          <button
            className={tab === "signup" ? "active" : ""}
            onClick={() => {
              setTab("signup");
              setError("");
            }}
          >
            Sign up
          </button>
        </div>

        {tab === "login" ? (
          <form className="form-card auth-form" onSubmit={customerLogin}>
            <span className="eyebrow">Member access</span>
            <h1>Welcome back</h1>
            <p>Log in to check out, track orders, and manage your RALLY account.</p>
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
            <Button type="submit">Log in</Button>
            <div className="form-switch">
              New to RALLY?{" "}
              <button type="button" onClick={() => setTab("signup")}>
                Sign up
              </button>
            </div>
          </form>
        ) : (
          <form className="form-card auth-form" onSubmit={signup}>
            <span className="eyebrow">Start your journey</span>
            <h1>Create account</h1>
            <p>Customer accounts are free. Staff accounts are created by the store.</p>
            <label>
              Full name
              <input name="fullName" required placeholder="Alex Morgan" />
            </label>
            <label>
              Tax ID
              <input name="taxId" required placeholder="Tax identification number" />
            </label>
            <label>
              Email
              <input name="email" required type="email" placeholder="alex@example.com" />
            </label>
            <label>
              Home address
              <textarea name="address" required placeholder="Street, city, postal code" />
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
              Use 8+ characters with at least one uppercase letter and one number.
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
            <Button type="submit">Create account</Button>
            <div className="form-switch">
              Already have an account?{" "}
              <button type="button" onClick={() => setTab("login")}>
                Log in
              </button>
            </div>
          </form>
        )}

        <div className="staff-login">
          <div>
            <span className="eyebrow">Store team</span>
            <h3>Staff login</h3>
            <p>Product, sales, and support accounts are issued by RALLY.</p>
          </div>
          <form onSubmit={staffLogin}>
            <input name="staffEmail" required type="email" placeholder="Staff email" />
            <input name="staffPassword" required type="password" placeholder="Password" />
            <Button variant="dark" type="submit">
              Open dashboard
            </Button>
          </form>
          {staffError && <div className="auth-error">{staffError}</div>}
        </div>

        <div className="demo-accounts">
          <b>Demo accounts</b>
          <span>Customer: jamie@rally.store / rally123</span>
          <span>Product: product@rally.store / staff123</span>
          <span>Sales: sales@rally.store / staff123</span>
          <span>Support: support@rally.store / staff123</span>
        </div>
      </div>
    </div>
  );
}
