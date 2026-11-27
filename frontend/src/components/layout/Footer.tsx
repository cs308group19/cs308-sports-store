import { type View } from "../../app/navigation";
import { LoopMark } from "../ui/Logo";
import type { HomeSection } from "./Header";

const STRIP_BACKGROUND = "#050B10";

function StripRun({ hidden = false }: { hidden?: boolean }) {
  return (
    <span className="strip-run" aria-hidden={hidden || undefined}>
      {[0, 1, 2, 3].map((index) => (
        <span className="strip-unit" key={index}>
          <span className="strip-name">RALLY</span>
          <LoopMark width={38} height={19} backdrop={STRIP_BACKGROUND} />
          <span className="strip-tagline">SPORTS STORE</span>
          <LoopMark width={38} height={19} backdrop={STRIP_BACKGROUND} />
        </span>
      ))}
    </span>
  );
}

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
      <button
        className="logo-strip"
        aria-label="RALLY, back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="marquee">
          <StripRun />
          <StripRun hidden />
        </span>
      </button>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} RALLY · Every brand, every game</span>
        <span>Payments are simulated for the course demo</span>
      </div>
    </footer>
  );
}
