export type Role = "Customer" | "Product Manager" | "Sales Manager" | "Support Agent";
export type Category = "Basketball" | "Football" | "Running" | "Gym" | "Sneakers" | "Accessories";
export type OrderStatus = "Processing" | "In transit" | "Delivered";

export interface Product {
  id: number;
  name: string;
  category: Category;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  stock: number;
  popularity: number;
  image: string;
  model: string;
  serial: string;
  warranty: string;
  distributor: string;
  description: string;
  cost?: number;
  warrantyStatus: "Active" | "Expired" | "Not applicable";
}

export interface OrderProduct {
  product: Product;
  quantity: number;
  pricePaid: number;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: OrderStatus;
  items: number;
  products: OrderProduct[];
  withinReturnWindow?: boolean;
}

/** A cart line as the backend returns it (SCRUM-16). */
export interface CartViewItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  quantity: number;
  lineTotal: number;
}

export interface CartView {
  items: CartViewItem[];
  total: number;
}

export interface ChatMessage {
  id: number;
  sender: "user" | "agent";
  text: string;
  time: string;
  attachment?: {
    name: string;
    type: "PDF" | "Image" | "Video";
  };
}
