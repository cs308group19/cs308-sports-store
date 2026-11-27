/** How a customer reaches a person (from SUPPORT_PHONE, SUPPORT_EMAIL and SUPPORT_HOURS). */
export interface AssistantContact {
  phone: string;
  email: string;
  hours: string;
}

/** A product Rally talks about, with what the widget needs to draw its card. */
export interface AssistantProduct {
  id: number | string;
  name: string;
  /** Read from the start of the name, null for unbranded products. */
  brand: string | null;
  /** Price the customer pays today (discount applied). */
  price: number;
  /** List price, only when a discount is active. */
  oldPrice?: number;
  stock: number;
  /** The uploaded photo, or null: the frontend then shows its catalogue photo for `model`. */
  image: string | null;
  model: string;
}

/** Answer of POST /api/assistant/chat. */
export interface AssistantReply {
  reply: string;
  products: AssistantProduct[];
  /** Set when the reply sends the customer to a person. */
  contact?: AssistantContact;
}
