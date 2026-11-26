import { useEffect, useRef, useState } from "react";
import type { Role, Product, CartView } from "./types/models";
import { addCartItem, cartErrorMessage, fetchCart, mergeGuestCart, removeCartItem, setCartQuantity } from "./services/cartApi";
import { products } from "./services/mockStore";
import { type View, roleDefaults, roleNav, staffViews } from "./app/navigation";
import { useAuth } from "./auth/AuthProvider";
import type { SessionUser } from "./auth/types";
import { Footer } from "./components/layout/Footer";
import { Header } from "./components/layout/Header";
import { SupportChat } from "./components/layout/SupportChat";
import { Button } from "./components/ui/Button";
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

interface CheckoutInvoice {
  id: string;
  customerId: string;
}

export default function App() {
  const { user, loading, signOut } = useAuth();
  const role: Role = user?.role ?? "Customer";
  const [view, setView] = useState<View>(window.location.pathname === "/auth" ? "login" : "home");
  const [returnTo, setReturnTo] = useState<View>("home");
  const [authOrigin, setAuthOrigin] = useState<View>("home");
  const [selected, setSelected] = useState<Product>(products[0]);
  const [cart, setCart] = useState<CartView>({ items: [], total: 0 });
  const [cartLoad, setCartLoad] = useState<{ userId: string; status: "ready" | "failed" } | null>(null);
  const [cartRetry, setCartRetry] = useState(0);
  const [checkoutInvoice, setCheckoutInvoice] = useState<CheckoutInvoice | null>(null);
  const [wishlist, setWishlist] = useState<Product[]>([products[0], products[4]]);
  const [shopCategory, setShopCategory] = useState("");
  const [toast, setToast] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setCheckoutInvoice(null);
      setView(window.location.pathname === "/auth" ? "login" : "home");
    };
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

  // If the session ends while a staff page, orders or the profile is open (expired or revoked),
  // leave that page.
  useEffect(() => {
    if (!loading && !user && (staffViews.has(view) || view === "orders" || view === "profile"))
      setView("home");
  }, [loading, user, view]);

  useEffect(() => {
    setCheckoutInvoice((invoice) => invoice?.customerId === user?.id ? invoice : null);
  }, [user?.id]);

  const navigate = (next: View, invoice: CheckoutInvoice | null = null) => {
    setCheckoutInvoice(invoice);
    // SCRUM-22/27/43. Guests log in before opening checkout, order history or their profile.
    if ((next === "checkout" || next === "orders" || next === "profile") && !user) {
      setAuthOrigin(view);
      setReturnTo(next);
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
    if (next === "shop") setShopCategory("");
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

  // Load the cart on page load and after login. A guest cart is merged into the customer cart first.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setCartLoad(null);
    void (async () => {
      try {
        if (user) await mergeGuestCart();
        const currentCart = await fetchCart(Boolean(user));
        if (cancelled) return;
        setCart(currentCart);
        if (user) setCartLoad({ userId: user.id, status: "ready" });
      } catch (error) {
        if (cancelled) return;
        if (user) setCartLoad({ userId: user.id, status: "failed" });
        notify(cartErrorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // The cart depends on who is signed in, not on the rest of the user object.
  }, [loading, user?.id, cartRetry]);

  const addToCart = async (product: Product) => {
    try {
      setCart(await addCartItem(product.id, Boolean(user)));
      notify(`${product.name} added to cart`);
    } catch (error) {
      notify(cartErrorMessage(error));
    }
  };

  const changeCartQuantity = async (productId: string, quantity: number) => {
    try {
      setCart(await setCartQuantity(productId, quantity, Boolean(user)));
    } catch (error) {
      notify(cartErrorMessage(error));
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      setCart(await removeCartItem(productId, Boolean(user)));
    } catch (error) {
      notify(cartErrorMessage(error));
    }
  };

  /** Opens the shop on one category (slug from GET /api/categories). */
  const openCategory = (slug: string) => {
    navigate("shop");
    setShopCategory(slug);
  };

  const openProduct = (product: Product) => {
    setSelected(product);
    navigate("product");
  };

  const screen = (() => {
    if (view === "home")
      return (
        <Home
          navigate={navigate}
          openCategory={openCategory}
          openProduct={openProduct}
          addToCart={addToCart}
        />
      );
    if (view === "shop")
      return (
        <Shop openProduct={openProduct} addToCart={addToCart} initialCategory={shopCategory} />
      );
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
    if (view === "cart")
      return (
        <Cart
          cart={cart}
          changeQuantity={changeCartQuantity}
          removeItem={removeFromCart}
          navigate={navigate}
        />
      );
    if (view === "login")
      return (
        <AuthPage
          onAuthenticated={finishAuthentication}
          onCancel={() => navigate(authOrigin === "login" ? "home" : authOrigin)}
        />
      );
    if (view === "checkout") {
      const status = cartLoad?.userId === user?.id ? cartLoad?.status : undefined;
      if (user?.role === "Customer" && !loading && status === "ready") {
        return (
          <Checkout
            key={user.id}
            cart={cart}
            customer={user}
            onSuccess={(id) => {
              setCart({ items: [], total: 0 });
              navigate("invoice", { id, customerId: user.id });
            }}
            onCartRefresh={setCart}
            backToCart={() => navigate("cart")}
          />
        );
      }
      return (
        <div className="page narrow">
          <h1>Checkout</h1>
          {!loading && !user ? (
            <Button onClick={() => navigate("checkout")}>Sign in to continue</Button>
          ) : !loading && user?.role !== "Customer" ? (
            <p>Checkout is available to customer accounts.</p>
          ) : status === "failed" ? (
            <>
              <p role="alert">Could not load your cart.</p>
              <Button onClick={() => setCartRetry((attempt) => attempt + 1)}>Try again</Button>
            </>
          ) : (
            <p role="status">Loading your cart…</p>
          )}
        </div>
      );
    }
    if (view === "invoice") {
      const invoiceId = user?.role === "Customer" && checkoutInvoice?.customerId === user.id
        ? checkoutInvoice.id
        : null;
      return <Invoice key={invoiceId ?? "missing"} invoiceId={invoiceId} notify={notify} navigate={navigate} />;
    }
    // Keyed by the account, so signing in as someone else always loads their own orders.
    if (view === "orders") return user ? <Orders key={user.id} /> : null;
    if (view === "wishlist")
      return <Wishlist products={wishlist} openProduct={openProduct} addToCart={addToCart} />;
    if (view === "profile") return user ? <Profile user={user} navigate={navigate} /> : null;
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
        cartCount={cart.items.reduce((sum, line) => sum + line.quantity, 0)}
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
