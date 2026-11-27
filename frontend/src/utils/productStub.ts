import type { Product } from "../types/models";

/**
 * What a cart line or order line knows about its product: enough to open the product page, which
 * then loads the rest by id. An empty category marks the details as not loaded yet.
 */
export function productStub(known: {
  id: Product["id"];
  name: string;
  price: number;
  image: string;
  model?: string | null;
}): Product {
  return {
    id: known.id,
    name: known.name,
    price: known.price,
    image: known.image,
    model: known.model ?? "",
    category: "",
    rating: 0,
    reviews: 0,
    stock: 0,
    popularity: 0,
    serial: "",
    warranty: "",
    warrantyStatus: "Not applicable",
    distributor: "",
    description: "",
  };
}
