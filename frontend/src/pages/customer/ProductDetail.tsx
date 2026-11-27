import { useEffect, useRef, useState } from "react";
import type { Product, ProductComment } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { SectionHead } from "../../components/ui/SectionHead";
import { Skeleton } from "../../components/ui/Skeleton";
import { ImageZoom } from "../../components/ui/ImageZoom";
import { Stars } from "../../components/ui/Stars";
import { TiltCard } from "../../components/ui/TiltCard";
import { ApiError } from "../../lib/api";
import { fetchProductDetail } from "../../services/productApi";
import { brandOf } from "../../utils/brands";
import { flyToCart } from "../../utils/flyToCart";
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
  openCategory,
  openBrand,
  refreshKey = 0,
}: {
  product: Product;
  addToCart: (p: Product) => void;
  onWishlist: (p: Product) => void;
  navigate: (v: View) => void;
  openCategory: (slug: string) => void;
  openBrand: (brand: string) => void;
  refreshKey?: number;
}) {
  const [product, setProduct] = useState<Product>(initial);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const prevInitial = useRef(initial);
  const [zoomed, setZoomed] = useState(false);
  const photo = useRef<HTMLButtonElement>(null);

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

  // A product opened from a cart or order line has only its name until the details arrive.
  if (!product.category) {
    return (
      <div className="page" aria-busy={state.status === "loading"}>
        {state.status === "loading" ? (
          <div className="product-detail">
            <span className="sr-only" role="status">
              Loading product
            </span>
            <Skeleton className="detail-skeleton" />
            <div className="detail-copy">
              <Skeleton style={{ height: 16, width: "30%" }} />
              <Skeleton style={{ height: 52, width: "90%" }} />
              <Skeleton style={{ height: 44, width: "40%" }} />
              <Skeleton style={{ height: 130 }} />
            </div>
          </div>
        ) : (
          <div className="empty">
            <h2>This product could not be loaded</h2>
            <p>Please check your connection and open it again.</p>
            <Button onClick={() => navigate("shop")}>Browse the shop</Button>
          </div>
        )}
      </div>
    );
  }

  const inStock = product.stock > 0;
  const brand = brandOf(product.name);
  const saving = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  return (
    <div className="page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button onClick={() => navigate("shop")}>Shop</button>
        <span aria-hidden="true">/</span>
        <button onClick={() => openCategory(product.category.toLowerCase())}>{product.category}</button>
        {brand && (
          <>
            <span aria-hidden="true">/</span>
            <button onClick={() => openBrand(brand)}>{brand}</button>
          </>
        )}
      </nav>
      <div className="product-detail" aria-busy={state.status === "loading"}>
        <TiltCard max={10} className="detail-tilt">
          <button
            ref={photo}
            className="detail-image"
            aria-label="Zoom product photo"
            aria-haspopup="dialog"
            onClick={() => setZoomed(true)}
          >
            <img src={product.image} alt={product.name} width="800" height="800" />
            {product.oldPrice && <span className="discount">SALE</span>}
            <span className="zoom-hint" aria-hidden="true">
              <Icon name="zoom" size={16} /> Click to zoom
            </span>
          </button>
        </TiltCard>
        {zoomed && (
          <ImageZoom
            src={product.image}
            alt={product.name}
            onClose={() => {
              setZoomed(false);
              photo.current?.focus();
            }}
          />
        )}
        <div className="detail-copy">
          <span className="detail-label">{brand ? `${brand} · ${product.category}` : product.category}</span>
          <h1>{product.name}</h1>
          <div className="detail-rating">
            <Stars rating={product.rating} />
            <span className="review-count">
              {product.reviews} rating{product.reviews === 1 ? "" : "s"}
            </span>
          </div>
          <div className="detail-price">
            <b>{money(product.price)}</b>
            {product.oldPrice && (
              <>
                <s>{money(product.oldPrice)}</s>
                <span className="saving">Save {saving}%</span>
              </>
            )}
          </div>
          <p>{product.description}</p>
          <div className={`stock-callout ${inStock ? "" : "none"}`}>
            <span></span>
            {inStock ? `${product.stock} in stock · ready to ship` : "Currently out of stock"}
          </div>
          {state.status === "offline" && (
            <small className="return-status">
              Live stock could not be loaded. Showing the last known details.
            </small>
          )}
          <div className="detail-actions">
            <Button
              disabled={!inStock}
              onClick={() => {
                addToCart(product);
                flyToCart(photo.current?.querySelector("img"));
              }}
            >
              {inStock ? "Add to cart" : "Out of stock"} <Icon name="bag" size={18} />
            </Button>
            <Button variant="outline" aria-label="Add to wishlist" onClick={() => onWishlist(product)}>
              <Icon name="heart" />
            </Button>
          </div>
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
          onAction={() => navigate("review")}
        />
        <ReviewList state={state} />
      </section>
    </div>
  );
}

function ReviewList({ state }: { state: LoadState }) {
  if (state.status === "loading")
    return (
      <div className="review-cards">
        <span className="sr-only" role="status">
          Loading reviews
        </span>
        <Skeleton className="review-skeleton" />
        <Skeleton className="review-skeleton" />
      </div>
    );
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
