import { PHOTO_UNAVAILABLE } from "../../services/productPhotos";
import type { RallyCard } from "./rallyChat";

/** A product inside one of Rally's messages. The whole card opens the product page. */
export function RallyProductCard({ card, onOpen }: { card: RallyCard; onOpen: () => void }) {
  return (
    <button type="button" className="rally-card" onClick={onOpen}>
      <img
        src={card.image}
        alt=""
        onError={(event) => {
          if (!event.currentTarget.src.endsWith(PHOTO_UNAVAILABLE)) {
            event.currentTarget.src = PHOTO_UNAVAILABLE;
          }
        }}
      />
      <span className="rally-card-text">
        <b>{card.name}</b>
        <span>{card.meta}</span>
      </span>
      <span className="rally-card-view">View</span>
    </button>
  );
}
