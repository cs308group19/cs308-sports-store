import { useEffect, useRef, useState } from "react";
import type { Role, Product, CartLine } from "./types/models";
import { products } from "./services/mockStore";
import { type View, roleDefaults, roleNav, staffViews } from "./app/navigation";
import { useAuth } from "./auth/AuthProvider";
import type { SessionUser } from "./auth/types";
import { Footer } from "./components/layout/Footer";
import { Header } from "./components/layout/Header";
import { SupportChat } from "./components/layout/SupportChat";
import { Icon } from "./components/ui/Icon";
import { AuthPage } from "./pages/auth/AuthPage";
import { Cart } from "./pages/customer/Cart";
import { Checkout } from "./pages/customer/Checkout";
import { Home } from "./pages/customer/Home";
import { Invoice } from "./pages/customer/Invoice";
import { Orders } from "./pages/customer/Orders";
import { ProductDetail } from "./pages/customer/ProductDetail";
import { Profile } from "./pages/customer/Profile";
import { ReviewForm } from "./pages/customer/ReviewForm";
import { Shop } from "./pages/customer/Shop";
import { Wishlist } from "./pages/customer/Wishlist";
import { Deliveries } from "./pages/product-manager/Deliveries";
import { ProductManagement } from "./pages/product-manager/ProductManagement";
import { ReviewQueue } from "./pages/product-manager/ReviewQueue";
import { Analytics } from "./pages/sales-manager/Analytics";
import { Invoices } from "./pages/sales-manager/Invoices";
import { Pricing } from "./pages/sales-manager/Pricing";
import { Refunds } from "./pages/sales-manager/Refunds";
import { SupportDesk } from "./pages/support-agent/SupportDesk";

export default function App() {
  const { user, loading, signOut } = useAuth();
  const role: Role = user?.role ?? "Customer";
  const [view, setView] = useState<View>(window.location.pathname === "/auth" ? "login" : "home");
  const [returnTo, setReturnTo] = useState<View>("home");
  const [authOrigin, setAuthOrigin] = useState<View>("home");
  const [selected, setSelected] = useState<Product>(products[0]);
  const [cart, setCart] = useState<CartLine[]>([{ product: products[2], quantity: 1 }]);
  const [wishlist, setWishlist] = useState<Product[]>([products[0], products[4]]);
  const [toast, setToast] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => setView(window.location.pathname === "/auth" ? "login" : "home");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // After a page reload, send a signed-in staff member straight to their dashboard.
  const restoredSession = useRef(false);
  useEffect(() => {
    if (loading || restoredSession.current) return;
    restoredSession.current = true;
    if (user && user.role !== "Customer") setView(roleDefaults[user.role]);
  }, [loading, user]);

  // If the session ends while a staff page is open (expired or revoked), leave that page.
  useEffect(() => {
    if (!loading && !user && staffViews.has(view)) setView("home");
  }, [loading, user, view]);

  const navigate = (next: View) => {
    if (next === "checkout" && !user) {
      setAuthOrigin(view);
      setReturnTo("checkout");
      setView("login");
      window.history.pushState({}, "", "/auth");
      setMobileOpen(false);
      return;
    }
    if (staffViews.has(next) && (!user || user.role === "Customer")) {
      setAuthOrigin(view);
      setReturnTo(next);
      setView("login");
      window.history.pushState({}, "", "/auth");
      setMobileOpen(false);
      return;
    }
    if (next === "login") {
      const origin = view === "login" ? "home" : view;
      setAuthOrigin(origin);
      setReturnTo(origin);
    }
    setView(next);
    window.history.pushState({}, "", next === "login" ? "/auth" : "/");
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finishAuthentication = (account: SessionUser) => {
    const destination = account.role === "Customer" ? returnTo : roleDefaults[account.role];
    setView(staffViews.has(destination) && account.role === "Customer" ? "home" : destination);
    window.history.replaceState({}, "", "/");
    notify(`Welcome, ${account.name}`);
  };

  const logout = async () => {
    await signOut();
    setView("home");
    window.history.pushState({}, "", "/");
    notify("You have been logged out");
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found)
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      return [...current, { product, quantity: 1 }];
    });
    notify(`${product.name} added to cart`);
  };

  const openProduct = (product: Product) => {
    setSelected(product);
    navigate("product");
  };

  const screen = (() => {
    if (view === "home")
      return <Home navigate={navigate} openProduct={openProduct} addToCart={addToCart} />;
    if (view === "shop") return <Shop openProduct={openProduct} addToCart={addToCart} />;
    if (view === "product")
      return (
        <ProductDetail
          product={selected}
          addToCart={addToCart}
          onWishlist={() => {
            setWishlist((w) => (w.some((p) => p.id === selected.id) ? w : [...w, selected]));
            notify("Saved to your wishlist");
          }}
          navigate={navigate}
        />
      );
    if (view === "cart") return <Cart cart={cart} setCart={setCart} navigate={navigate} />;
    if (view === "login")
      return (
        <AuthPage
          onAuthenticated={finishAuthentication}
          onCancel={() => navigate(authOrigin === "login" ? "home" : authOrigin)}
        />
      );
    if (view === "checkout") return <Checkout cart={cart} navigate={navigate} />;
    if (view === "invoice") return <Invoice notify={notify} navigate={navigate} />;
    if (view === "orders") return <Orders notify={notify} navigate={navigate} />;
    if (view === "wishlist")
      return <Wishlist products={wishlist} openProduct={openProduct} addToCart={addToCart} />;
    if (view === "profile") return <Profile notify={notify} />;
    if (view === "review") return <ReviewForm notify={notify} navigate={navigate} />;
    if (view === "pm-products") return <ProductManagement notify={notify} />;
    if (view === "pm-deliveries") return <Deliveries notify={notify} />;
    if (view === "pm-invoices") return <Invoices notify={notify} manager="product" />;
    if (view === "pm-reviews") return <ReviewQueue notify={notify} />;
    if (view === "sales-pricing") return <Pricing notify={notify} />;
    if (view === "sales-invoices") return <Invoices notify={notify} />;
    if (view === "sales-analytics") return <Analytics />;
    if (view === "sales-refunds") return <Refunds notify={notify} />;
    return <SupportDesk notify={notify} />;
  })();

  if (loading) return <div className="app" aria-busy="true" />;

  return (
    <div className="app">
      <Header
        role={role}
        user={user}
        logout={logout}
        nav={roleNav[role]}
        view={view}
        navigate={navigate}
        cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main>{screen}</main>
      {role === "Customer" && <Footer navigate={navigate} />}
      <SupportChat open={chatOpen} setOpen={setChatOpen} />
      {toast && (
        <div className="toast">
          <span className="toast-check">
            <Icon name="check" size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
