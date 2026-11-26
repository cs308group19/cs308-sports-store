import { useEffect, useRef, useState } from "react";
import type { Product, ProductComment } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { SectionHead } from "../../components/ui/SectionHead";
import { Stars } from "../../components/ui/Stars";
import { ApiError } from "../../lib/api";
import { fetchProductDetail } from "../../services/productApi";
import { money } from "../../utils/format";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; comments: ProductComment[] }
  | { status: "not-found" }
  | { status: "offline" };

/**
 * SCRUM-14. Shows the product the shopper clicked straight away, then refreshes it from
 * GET /api/products/:id so price, stock and approved comments come from the database.
 */
export function ProductDetail({
  product: initial,
  addToCart,
  onWishlist,
  navigate,
  refreshKey = 0,
}: {
  product: Product;
  addToCart: (p: Product) => void;
  onWishlist: () => void;
  navigate: (v: View) => void;
  refreshKey?: number;
}) {
  const [product, setProduct] = useState<Product>(initial);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const prevInitial = useRef(initial);

  useEffect(() => {
    let cancelled = false;
    if (prevInitial.current !== initial) {
      prevInitial.current = initial;
      setProduct(initial);
    }
    setState({ status: "loading" });
    fetchProductDetail(initial.id)
      .then((detail) => {
        if (cancelled) return;
        const { comments, ...fresh } = detail;
        setProduct(fresh);
        setState({ status: "ready", comments });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Keep showing what the shop list already had; only the live data is missing.
        setState({
          status: error instanceof ApiError && error.status === 404 ? "not-found" : "offline",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [initial, refreshKey]);

  if (state.status === "not-found") {
    return (
      <div className="page">
        <button className="back-link" onClick={() => navigate("shop")}>
          ← Back to shop
        </button>
        <div className="empty">
          <h2>This product is no longer available</h2>
          <p>It may have been removed from the store.</p>
          <Button onClick={() => navigate("shop")}>Browse the shop</Button>
        </div>
      </div>
    );
  }

  const inStock = product.stock > 0;

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate("shop")}>
        ← Back to shop
      </button>
      <div className="product-detail" aria-busy={state.status === "loading"}>
        <div className="detail-image">
          <img src={product.image} alt={product.name} />
          {product.oldPrice && <span className="discount">SALE</span>}
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <Stars rating={product.rating} />
          <span className="review-count">
            {product.reviews} rating{product.reviews === 1 ? "" : "s"}
          </span>
          <div className="detail-price">
            {money(product.price)} {product.oldPrice && <s>{money(product.oldPrice)}</s>}
          </div>
          <p>{product.description}</p>
          <dl>
            <div>
              <dt>Product ID</dt>
              <dd>RLY-P-{String(product.id).padStart(4, "0")}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{product.name}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{product.model}</dd>
            </div>
            <div>
              <dt>Serial number</dt>
              <dd>{product.serial}</dd>
            </div>
            <div>
              <dt>Warranty status</dt>
              <dd>
                {product.warrantyStatus} · {product.warranty}
              </dd>
            </div>
            <div>
              <dt>Distributor</dt>
              <dd>{product.distributor}</dd>
            </div>
            <div>
              <dt>Quantity in stock</dt>
              <dd>{product.stock}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{money(product.price)}</dd>
            </div>
          </dl>
          <div className={`stock-callout ${inStock ? "" : "none"}`}>
            <span></span>
            {inStock ? `${product.stock} units ready to ship` : "Currently out of stock"}
          </div>
          {state.status === "offline" && (
            <small className="return-status">
              Live stock could not be loaded. Showing the last known details.
            </small>
          )}
          <div className="detail-actions">
            <Button disabled={!inStock} onClick={() => addToCart(product)}>
              {inStock ? "Add to cart" : "Out of stock"} <Icon name="bag" size={18} />
            </Button>
            <Button variant="outline" aria-label="Add to wishlist" onClick={onWishlist}>
              <Icon name="heart" />
            </Button>
          </div>
          <div className="delivery-note">
            <Icon name="truck" />
            <span>
              <b>Free delivery over $75</b>
              <small>Easy returns within 30 days</small>
            </span>
          </div>
        </div>
      </div>
      <section className="reviews">
        <SectionHead
          eyebrow="Athlete feedback"
          title="Ratings & reviews"
          action="Write a review"
          onAction={() => navigate("orders")}
        />
        <ReviewList state={state} />
      </section>
    </div>
  );
}

function ReviewList({ state }: { state: LoadState }) {
  if (state.status === "loading") return <p className="empty">Loading reviews…</p>;
  if (state.status !== "ready") return <p className="empty">Reviews could not be loaded.</p>;
  if (state.comments.length === 0)
    return <p className="empty">No reviews yet. Customers can review after delivery.</p>;

  return (
    <div className="review-cards">
      {state.comments.map((review) => (
        <article key={review.id}>
          <Stars rating={review.rating} />
          <p>“{review.comment}”</p>
          <b>{review.author}</b>
          <small>Verified buyer · {new Date(review.createdAt).toLocaleDateString("en-US")}</small>
        </article>
      ))}
    </div>
  );
}
