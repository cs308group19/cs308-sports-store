import { type View } from "../../app/navigation";
import type { HomeSection } from "./Header";

export function Footer({
  navigate,
  openCategory,
  goToSection,
  signedIn,
}: {
  navigate: (v: View) => void;
  openCategory: (slug: string) => void;
  goToSection: (section: HomeSection) => void;
  signedIn: boolean;
}) {
  return (
    <footer>
      <div className="footer-main">
        <div>
          <b>Shop</b>
          <button onClick={() => navigate("shop")}>All products</button>
          <button onClick={() => goToSection("drop")}>New this week</button>
          <button onClick={() => goToSection("brands")}>Brands</button>
          <button onClick={() => goToSection("sale")}>Sale</button>
        </div>
        <div>
          <b>Sports</b>
          <button onClick={() => openCategory("running")}>Running</button>
          <button onClick={() => openCategory("basketball")}>Basketball</button>
          <button onClick={() => openCategory("football")}>Football</button>
        </div>
        <div>
          <b>Account</b>
          <button onClick={() => navigate(signedIn ? "profile" : "login")}>{signedIn ? "Profile" : "Sign in"}</button>
          <button onClick={() => navigate("orders")}>My orders</button>
          <button onClick={() => navigate("wishlist")}>Wishlist</button>
          <button onClick={() => navigate("cart")}>Cart</button>
          <button onClick={() => goToSection("journal")}>Journal</button>
        </div>
        <div>
          <b>RALLY</b>
          <p>Authentic gear from the brands you trust.</p>
          <p>CS308 Team 19 · Sabancı University</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} RALLY · Every brand, every game</span>
        <span>Payments are simulated for the course demo</span>
      </div>
    </footer>
  );
}
