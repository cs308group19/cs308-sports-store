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
    name: "Nike Women Grey Air Max 2011 Sports Shoes",
    model: "NK-AM11-GRY",
    category: "Running",
    price: 95.2,
    oldPrice: 119,
    rating: 4.8,
    reviews: 126,
    stock: 14,
    popularity: 98,
  },
  {
    name: "Nike Women Dunk High Skinny Olive Casual Shoes",
    model: "NK-DUNK-OLV",
    category: "Basketball",
    price: 109,
    rating: 4.7,
    reviews: 89,
    stock: 8,
    popularity: 94,
  },
  {
    name: "Converse Men Navy Chuck Taylor All Star Canvas Shoes",
    model: "CV-CTAS-NVY",
    category: "Sneakers",
    price: 79,
    rating: 4.6,
    reviews: 74,
    stock: 21,
    popularity: 91,
  },
  {
    name: "Puma Liga Football",
    model: "PM-LIGA-GLD",
    category: "Football",
    price: 25,
    rating: 4.9,
    reviews: 203,
    stock: 0,
    popularity: 96,
  },
  {
    name: "Roll-Up Exercise Mats, Set of 2",
    model: "GY-MAT-SET2",
    category: "Gym",
    price: 19.6,
    oldPrice: 28,
    rating: 4.5,
    reviews: 61,
    stock: 32,
    popularity: 82,
  },
  {
    name: "Puma Unisex Fundamentals Red Water Bottle",
    model: "PM-BTL-RED",
    category: "Accessories",
    price: 13,
    rating: 4.4,
    reviews: 45,
    stock: 55,
    popularity: 78,
  },
  {
    name: "Fingerless Training Gloves",
    model: "GY-GLV-BLK",
    category: "Gym",
    price: 16,
    rating: 4.3,
    reviews: 38,
    stock: 17,
    popularity: 73,
  },
  {
    name: "Puma Unisex White Cap",
    model: "PM-CAP-WHT",
    category: "Running",
    price: 15,
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
    total: 114.8,
    status: "In transit",
    items: 2,
    products: [
      { product: products[0], quantity: 1, pricePaid: 95.2 },
      { product: products[4], quantity: 1, pricePaid: 19.6 },
    ],
  },
  {
    id: "RLY-79984",
    date: "May 03, 2025",
    total: 79,
    status: "Delivered",
    items: 1,
    withinReturnWindow: true,
    products: [{ product: products[2], quantity: 1, pricePaid: 79 }],
  },
  {
    id: "RLY-81102",
    date: "May 22, 2025",
    total: 43,
    status: "Processing",
    items: 2,
    products: [
      { product: products[5], quantity: 1, pricePaid: 13 },
      { product: products[7], quantity: 2, pricePaid: 15 },
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
