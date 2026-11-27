import { useEffect, useRef, useState } from "react";
import type { Role } from "../../types/models";
import { type View, roleDefaults } from "../../app/navigation";
import type { SessionUser } from "../../auth/types";
import { useRafScroll } from "../../hooks/useRafScroll";
import { clamp } from "../../utils/motion";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/Logo";

/** Sections of the home page the header links to. */
export type HomeSection = "drop" | "brands" | "sports" | "trending" | "journal" | "sale";

const SECTION_LINKS: Array<[string, HomeSection]> = [
  ["Brands", "brands"],
  ["Sports", "sports"],
  ["Journal", "journal"],
  ["Sale", "sale"],
];

/** The page is scrolled this far before the bar shrinks. */
const COMPACT_AFTER = 150;
const GLASS_FADE_DISTANCE = 300;

export function Header({
  role,
  user,
  logout,
  nav,
  view,
  navigate,
  goToSection,
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
  goToSection: (section: HomeSection) => void;
  cartCount: number;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const header = useRef<HTMLElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const customer = role === "Customer";
  const variant = !customer ? "staff" : view === "home" ? "float" : "bar";
  const checkoutStep = view === "checkout" ? 2 : view === "invoice" ? 3 : 0;

  useRafScroll(() => {
    const bar = header.current;
    if (!bar) return;
    const y = window.scrollY;
    bar.classList.toggle("header--compact", y > COMPACT_AFTER);
    bar.style.setProperty("--nav-p", clamp(y / GLASS_FADE_DISTANCE, 0, 1).toFixed(3));
  });

  useEffect(() => setAccountOpen(false), [view, user?.id]);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !account.current?.contains(event.target as Node))
        setAccountOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [accountOpen]);

  const go = (target: View) => {
    setAccountOpen(false);
    navigate(target);
  };
  const section = (id: HomeSection) => {
    setMobileOpen(false);
    goToSection(id);
  };

  const accountLinks: Array<[string, View]> = user
    ? [
        ["My profile", "profile"],
        ["My orders", "orders"],
        ["Wishlist", "wishlist"],
      ]
    : [
        ["Sign in", "login"],
        ["My orders", "orders"],
        ["Wishlist", "wishlist"],
      ];

  return (
    <header ref={header} className={`header header--${variant}`}>
      <div className="header-bar">
        <button className="header-logo" aria-label="RALLY home" onClick={() => go(roleDefaults[role])}>
          <Logo />
        </button>

        {checkoutStep > 0 && customer ? (
          <ol className="header-steps" aria-label="Checkout progress">
            {["Cart", "Payment", "Invoice"].map((label, index) => {
              const state = index + 1 < checkoutStep ? "done" : index + 1 === checkoutStep ? "current" : "next";
              return (
                <li key={label} className={state} aria-current={state === "current" ? "step" : undefined}>
                  <span aria-hidden="true">{state === "done" ? "✓" : index + 1}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        ) : (
          <nav className="header-nav" aria-label="Main">
            {customer ? (
              <>
                <button
                  className={view === "home" || view === "shop" || view === "product" ? "active" : ""}
                  onClick={() => go("shop")}
                >
                  Shop
                </button>
                {SECTION_LINKS.map(([label, id]) => (
                  <button key={id} onClick={() => section(id)}>
                    {label}
                  </button>
                ))}
              </>
            ) : (
              nav.map(([label, target]) => (
                <button key={target} className={view === target ? "active" : ""} onClick={() => go(target)}>
                  {label}
                </button>
              ))
            )}
          </nav>
        )}

        <div className="header-actions">
          {!customer && <span className="role-badge">{role}</span>}
          {customer && (
            <button className="icon-btn desktop-only" aria-label="Search" onClick={() => go("shop")}>
              <Icon name="search" />
            </button>
          )}
          {customer && (
            <div className="account desktop-only" ref={account}>
              <button
                className="icon-btn"
                aria-label={user ? `Account menu for ${user.name}` : "Account menu"}
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {user ? <span className="account-initial">{user.name.charAt(0).toUpperCase()}</span> : <Icon name="user" />}
              </button>
              {accountOpen && (
                <div className="account-menu">
                  {user && (
                    <p>
                      <b>{user.name}</b>
                      <small>{role}</small>
                    </p>
                  )}
                  {accountLinks.map(([label, target]) => (
                    <button key={target} onClick={() => go(target)}>
                      {label}
                    </button>
                  ))}
                  {user && (
                    <button className="logout-button" onClick={logout}>
                      Log out
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {!customer && user && (
            <div className="session-user desktop-only">
              <b>{user.name}</b>
              <button className="logout-button" onClick={logout}>
                Log out
              </button>
            </div>
          )}
          {customer && (
            <button
              className="cart-button"
              data-cart-target
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              onClick={() => go("cart")}
            >
              <Icon name="bag" size={19} />
              {cartCount > 0 && (
                <span key={cartCount} className="cart-count">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          <button
            className="icon-btn menu-button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="mobile-menu" aria-label="Menu">
          {(customer ? ([["Home", "home"], ["Shop", "shop"]] as Array<[string, View]>) : nav).map(([label, target]) => (
            <button key={target} className={view === target ? "active" : ""} onClick={() => go(target)}>
              {label}
            </button>
          ))}
          {customer &&
            SECTION_LINKS.map(([label, id]) => (
              <button key={id} onClick={() => section(id)}>
                {label}
              </button>
            ))}
          {customer &&
            accountLinks.map(([label, target]) => (
              <button key={target} className={view === target ? "active" : ""} onClick={() => go(target)}>
                {label}
              </button>
            ))}
          {user && (
            <button className="logout-button" onClick={logout}>
              Log out ({user.name})
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
