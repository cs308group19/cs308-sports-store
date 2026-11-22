import type { Category, Order, Product } from "../types/models";

import { cataloguePhoto } from "./cataloguePhoto";

const productSeeds: Array<
  Omit<
    Product,
    | "id"
    | "image"
    | "serial"
    | "warranty"
    | "warrantyStatus"
    | "distributor"
    | "description"
    | "cost"
  >
> = [
  {
    name: "AeroStride Pro",
    model: "AS-PRO-25",
    category: "Running",
    price: 129,
    oldPrice: 159,
    rating: 4.8,
    reviews: 126,
    stock: 14,
    popularity: 98,
  },
  {
    name: "Court Vision Elite",
    model: "CV-ELT-25",
    category: "Basketball",
    price: 145,
    rating: 4.7,
    reviews: 89,
    stock: 8,
    popularity: 94,
  },
  {
    name: "Velocity Knit",
    model: "VK-25",
    category: "Sneakers",
    price: 99,
    oldPrice: 119,
    rating: 4.6,
    reviews: 74,
    stock: 21,
    popularity: 91,
  },
  {
    name: "Match Pro Football",
    model: "MP-FB-5",
    category: "Football",
    price: 42,
    rating: 4.9,
    reviews: 203,
    stock: 0,
    popularity: 96,
  },
  {
    name: "CoreFlex Training Mat",
    model: "CF-MAT-6",
    category: "Gym",
    price: 39,
    oldPrice: 55,
    rating: 4.5,
    reviews: 61,
    stock: 32,
    popularity: 82,
  },
  {
    name: "HydraLock Bottle",
    model: "HL-750",
    category: "Accessories",
    price: 24,
    rating: 4.4,
    reviews: 45,
    stock: 55,
    popularity: 78,
  },
  {
    name: "PowerGrip Gloves",
    model: "PG-GLV-25",
    category: "Gym",
    price: 29,
    rating: 4.3,
    reviews: 38,
    stock: 17,
    popularity: 73,
  },
  {
    name: "SprintLite Cap",
    model: "SL-CAP-25",
    category: "Running",
    price: 22,
    oldPrice: 28,
    rating: 4.6,
    reviews: 29,
    stock: 9,
    popularity: 69,
  },
];

export const products: Product[] = productSeeds.map((product, index) => ({
  ...product,
  id: index + 1,
  image: cataloguePhoto(product.model),
  serial: `R-${89741 + index * 137}`,
  warranty: index % 2 ? "12 months" : "24 months",
  warrantyStatus: index === 5 ? "Not applicable" : "Active",
  distributor: index % 2 ? "Peak Performance Ltd." : "Northstar Athletics",
  cost: Number((product.price * 0.5).toFixed(2)),
  description:
    "Engineered for everyday athletes with durable, lightweight materials and a performance-first fit. Tested for comfort through long training sessions.",
}));

export const categories: Category[] = [
  "Basketball",
  "Football",
  "Running",
  "Gym",
  "Sneakers",
  "Accessories",
];

export const orders: Order[] = [
  {
    id: "RLY-80421",
    date: "May 18, 2025",
    total: 174,
    status: "In transit",
    items: 2,
    products: [
      { product: products[0], quantity: 1, pricePaid: 129 },
      { product: products[4], quantity: 1, pricePaid: 45 },
    ],
  },
  {
    id: "RLY-79984",
    date: "May 03, 2025",
    total: 99,
    status: "Delivered",
    items: 1,
    withinReturnWindow: true,
    products: [{ product: products[2], quantity: 1, pricePaid: 99 }],
  },
  {
    id: "RLY-81102",
    date: "May 22, 2025",
    total: 68,
    status: "Processing",
    items: 2,
    products: [
      { product: products[5], quantity: 1, pricePaid: 24 },
      { product: products[7], quantity: 2, pricePaid: 22 },
    ],
  },
];

export const mockStore = {
  async listProducts() {
    return Promise.resolve(products);
  },
  async getProduct(id: number) {
    return Promise.resolve(products.find((product) => product.id === id));
  },
  async listOrders() {
    return Promise.resolve(orders);
  },
};
