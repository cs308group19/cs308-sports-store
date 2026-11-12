import type { Role } from "../../types/models";
import { type View, roleDefaults } from "../../app/navigation";
import type { SessionUser } from "../../auth/types";
import { Icon } from "../ui/Icon";

export function Header({
  role,
  user,
  logout,
  nav,
  view,
  navigate,
  cartCount,
  mobileOpen,
  setMobileOpen,
}: {
  role: Role;
  user: SessionUser | null;
  logout: () => void;
  nav: Array<[string, View]>;
  view: View;
  navigate: (v: View) => void;
  cartCount: number;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  return (
    <header className="header">
      <div className="header-top">
        <button className="brand" onClick={() => navigate(roleDefaults[role])}>
          <span className="brand-mark">R</span>
          <span className="brand-lockup">
            <b>RALLY</b>
            <small>Play it your way</small>
          </span>
        </button>
        <nav className={`main-nav ${mobileOpen ? "open" : ""}`}>
          {nav.map(([label, target]) => (
            <button
              key={target}
              className={view === target ? "active" : ""}
              onClick={() => navigate(target)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {role !== "Customer" && <span className="role-badge">{role}</span>}
          {role === "Customer" && (
            <>
              <button
                className="icon-btn desktop-only"
                aria-label="Search"
                onClick={() => navigate("shop")}
              >
                <Icon name="search" />
              </button>
              <button
                className="icon-btn"
                aria-label={user ? "Profile" : "Log in"}
                onClick={() => navigate(user ? "profile" : "login")}
              >
                <Icon name="user" />
              </button>
              <button
                className="icon-btn cart-button"
                aria-label="Cart"
                onClick={() => navigate("cart")}
              >
                <Icon name="bag" />
                {cartCount > 0 && <span>{cartCount}</span>}
              </button>
            </>
          )}
          {user && (
            <div className="session-user">
              <button onClick={() => role === "Customer" && navigate("profile")}>
                <b>{user.name}</b>
                <small>{role}</small>
              </button>
              <button className="logout-button" onClick={logout}>
                Log out
              </button>
            </div>
          )}
          <button
            className="icon-btn menu-button"
            aria-label="Menu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
    </header>
  );
}
