import type { Product } from "../../types/models";
import { type View } from "../../app/navigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { SectionHead } from "../../components/ui/SectionHead";
import { Stars } from "../../components/ui/Stars";
import { money } from "../../utils/format";

export function ProductDetail({
  product,
  addToCart,
  onWishlist,
  navigate,
}: {
  product: Product;
  addToCart: (p: Product) => void;
  onWishlist: () => void;
  navigate: (v: View) => void;
}) {
  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate("shop")}>
        ← Back to shop
      </button>
      <div className="product-detail">
        <div className="detail-image">
          <img src={product.image} alt={product.name} />
          {product.oldPrice && <span className="discount">SALE</span>}
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <Stars rating={product.rating} />
          <span className="review-count">{product.reviews} verified reviews</span>
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
            {product.cost !== undefined && (
              <div>
                <dt>Cost</dt>
                <dd>{money(product.cost)} (optional)</dd>
              </div>
            )}
          </dl>
          <div className={`stock-callout ${product.stock ? "" : "none"}`}>
            <span></span>
            {product.stock ? `${product.stock} units ready to ship` : "Currently out of stock"}
          </div>
          <div className="detail-actions">
            <Button disabled={!product.stock} onClick={() => addToCart(product)}>
              Add to cart <Icon name="bag" size={18} />
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
          onAction={() => navigate("review")}
        />
        <div className="review-cards">
          <article>
            <Stars rating={5} />
            <p>“Excellent support and surprisingly light. My new go-to for daily training.”</p>
            <b>Jordan M.</b>
            <small>Verified buyer</small>
          </article>
          <article>
            <Stars rating={4} />
            <p>“Premium build, comfortable from the first session, and arrived quickly.”</p>
            <b>Alex R.</b>
            <small>Verified buyer</small>
          </article>
        </div>
      </section>
    </div>
  );
}
