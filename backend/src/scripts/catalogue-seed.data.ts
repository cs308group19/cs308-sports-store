/**
 * Demo catalogue for development and the progress demo (SCRUM-13). The live database starts
 * empty, so without these rows the shop, product pages and cart have nothing to show.
 *
 * Ratings and review counts are not seeded: they come from real reviews (SCRUM-31).
 */
export interface SeedCategory {
  name: string;
  slug: string;
  displayOrder: number;
}

export interface SeedProduct {
  sku: string;
  name: string;
  model: string;
  serialNumber: string;
  description: string;
  categorySlug: string;
  stock: number;
  price: number;
  /** Percentage off the list price, 0–100. */
  discountRate: number;
  cost: number;
  warrantyStatus: 'active' | 'expired' | 'not_applicable';
  warrantyTerm: string;
  distributor: string;
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { name: 'Running', slug: 'running', displayOrder: 1 },
  { name: 'Basketball', slug: 'basketball', displayOrder: 2 },
  { name: 'Football', slug: 'football', displayOrder: 3 },
  { name: 'Gym', slug: 'gym', displayOrder: 4 },
  { name: 'Sneakers', slug: 'sneakers', displayOrder: 5 },
  { name: 'Accessories', slug: 'accessories', displayOrder: 6 },
];

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    sku: 'RLY-RUN-001',
    name: 'AeroStride Pro',
    model: 'AS-PRO-25',
    serialNumber: 'R-89741',
    description:
      'Lightweight road running shoe with a responsive foam midsole and a breathable knit upper for long training runs.',
    categorySlug: 'running',
    stock: 14,
    price: 159,
    discountRate: 20,
    cost: 72,
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-RUN-002',
    name: 'SprintLite Cap',
    model: 'SL-CAP-25',
    serialNumber: 'R-89878',
    description:
      'Quick-drying running cap with a reflective band and a sweat-wicking inner lining.',
    categorySlug: 'running',
    stock: 9,
    price: 28,
    discountRate: 20,
    cost: 9,
    warrantyStatus: 'not_applicable',
    warrantyTerm: 'No warranty',
    distributor: 'Peak Performance Ltd.',
  },
  {
    sku: 'RLY-RUN-003',
    name: 'TrailBlazer GTX',
    model: 'TB-GTX-25',
    serialNumber: 'R-90015',
    description:
      'Waterproof trail running shoe with a grippy outsole and a rock plate for uneven ground.',
    categorySlug: 'running',
    stock: 0,
    price: 175,
    discountRate: 0,
    cost: 84,
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-BSK-001',
    name: 'Court Vision Elite',
    model: 'CV-ELT-25',
    serialNumber: 'B-41207',
    description:
      'High-top basketball shoe with ankle support, a cushioned heel and a herringbone outsole for quick cuts.',
    categorySlug: 'basketball',
    stock: 8,
    price: 145,
    discountRate: 0,
    cost: 66,
    warrantyStatus: 'active',
    warrantyTerm: '12 months',
    distributor: 'Peak Performance Ltd.',
  },
  {
    sku: 'RLY-BSK-002',
    name: 'Rebound Indoor Ball',
    model: 'RB-IND-7',
    serialNumber: 'B-41344',
    description:
      'Official size 7 composite leather basketball with deep channels for a steady grip indoors.',
    categorySlug: 'basketball',
    stock: 26,
    price: 49,
    discountRate: 0,
    cost: 18,
    warrantyStatus: 'active',
    warrantyTerm: '6 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-FTB-001',
    name: 'Match Pro Football',
    model: 'MP-FB-5',
    serialNumber: 'F-30518',
    description:
      'Size 5 thermo-bonded match ball that keeps its shape and flight in wet weather.',
    categorySlug: 'football',
    stock: 0,
    price: 42,
    discountRate: 0,
    cost: 15,
    warrantyStatus: 'active',
    warrantyTerm: '12 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-FTB-002',
    name: 'Striker FG Boots',
    model: 'ST-FG-25',
    serialNumber: 'F-30655',
    description:
      'Firm-ground football boots with a thin synthetic upper for close ball control.',
    categorySlug: 'football',
    stock: 12,
    price: 119,
    discountRate: 15,
    cost: 51,
    warrantyStatus: 'active',
    warrantyTerm: '12 months',
    distributor: 'Peak Performance Ltd.',
  },
  {
    sku: 'RLY-GYM-001',
    name: 'CoreFlex Training Mat',
    model: 'CF-MAT-6',
    serialNumber: 'G-77102',
    description:
      'Six-millimetre non-slip training mat for yoga, stretching and floor work.',
    categorySlug: 'gym',
    stock: 32,
    price: 55,
    discountRate: 30,
    cost: 17,
    warrantyStatus: 'active',
    warrantyTerm: '12 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-GYM-002',
    name: 'PowerGrip Gloves',
    model: 'PG-GLV-25',
    serialNumber: 'G-77239',
    description:
      'Padded lifting gloves with wrist wraps that protect your palms on heavy pulls.',
    categorySlug: 'gym',
    stock: 17,
    price: 29,
    discountRate: 0,
    cost: 10,
    warrantyStatus: 'expired',
    warrantyTerm: '6 months',
    distributor: 'Peak Performance Ltd.',
  },
  {
    sku: 'RLY-SNK-001',
    name: 'Velocity Knit',
    model: 'VK-25',
    serialNumber: 'S-55301',
    description:
      'Everyday knit sneaker with a sock-like fit and a soft foam sole.',
    categorySlug: 'sneakers',
    stock: 21,
    price: 119,
    discountRate: 15,
    cost: 48,
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
  },
  {
    sku: 'RLY-ACC-001',
    name: 'HydraLock Bottle',
    model: 'HL-750',
    serialNumber: 'A-12850',
    description:
      'Insulated 750 ml steel bottle that keeps drinks cold for 24 hours. Leak-proof lid.',
    categorySlug: 'accessories',
    stock: 55,
    price: 24,
    discountRate: 0,
    cost: 8,
    warrantyStatus: 'not_applicable',
    warrantyTerm: 'No warranty',
    distributor: 'Peak Performance Ltd.',
  },
  {
    sku: 'RLY-ACC-002',
    name: 'PulseBand Fitness Tracker',
    model: 'PB-FT-2',
    serialNumber: 'A-12987',
    description:
      'Water-resistant tracker that records heart rate, steps and sleep, with a seven-day battery.',
    categorySlug: 'accessories',
    stock: 4,
    price: 89,
    discountRate: 0,
    cost: 41,
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
  },
];
