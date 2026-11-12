import { type View } from "../../app/navigation";

export function Footer({ navigate }: { navigate: (v: View) => void }) {
  return (
    <footer>
      <div className="footer-main">
        <div>
          <div className="brand">
            <span className="brand-mark">R</span>
            <span className="brand-lockup">
              <b>RALLY</b>
              <small>Play it your way</small>
            </span>
          </div>
          <p>
            Performance gear for every athlete.
            <br />
            Play it your way.
          </p>
        </div>
        <div>
          <b>SHOP</b>
          <button onClick={() => navigate("shop")}>All products</button>
          <button onClick={() => navigate("shop")}>New arrivals</button>
          <button onClick={() => navigate("wishlist")}>Wishlist</button>
        </div>
        <div>
          <b>ACCOUNT</b>
          <button onClick={() => navigate("login")}>Sign in</button>
          <button onClick={() => navigate("orders")}>Orders</button>
          <button onClick={() => navigate("profile")}>Profile</button>
        </div>
        <div>
          <b>SUPPORT</b>
          <button>Shipping & returns</button>
          <button>Contact us</button>
          <button>Warranty</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} RALLY</span>
        <span>Secure checkout · 30-day returns · Athlete support</span>
      </div>
    </footer>
  );
}
