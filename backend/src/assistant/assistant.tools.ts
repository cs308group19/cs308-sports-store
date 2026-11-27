import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_FROM_CENTS,
  TAX_PERCENT,
} from '../checkout/checkout-totals.js';
import { isDatabaseId } from '../common/id.js';
import type { Env } from '../config/env.js';
import { OrderHistoryService } from '../orders/order-history.service.js';
import { ProductDetailService } from '../products/product-detail.service.js';
import type { ProductSummaryResponse } from '../products/product-detail.types.js';
import { ProductListService } from '../products/product-list.service.js';
import { brandOf } from './assistant.brands.js';
import { bestMatches } from './assistant.search.js';
import type { AssistantContact, AssistantProduct } from './assistant.types.js';
import type { GeminiFunctionDeclaration } from './gemini.types.js';

export const MAX_SEARCH_RESULTS = 6;
export const MAX_ORDERS = 5;
export const RETURN_WINDOW_DAYS = 30;

/** Who is chatting. Decided from the session, never from anything the model or the user sends. */
export interface ToolContext {
  /** The signed-in customer, or null for a guest (or a staff account). */
  customerId: string | null;
}

export interface ToolResult {
  /** What the model reads. */
  response: Record<string, unknown>;
  /** Products in the result, which may become cards under the reply. */
  products: AssistantProduct[];
}

export const TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'search_products',
    description: `Search the products the store sells right now. Returns up to ${MAX_SEARCH_RESULTS}, most popular first, with price and stock. All arguments are optional; the catalogue is in English.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'One to three English keywords, for example "running shoe" or "backpack".',
        },
        category: {
          type: 'string',
          description:
            'Category: running, basketball, football, gym, sneakers or accessories.',
        },
        brand: { type: 'string', description: 'Brand name, for example Nike.' },
        maxPrice: {
          type: 'number',
          description: 'Highest price in US dollars, after any discount.',
        },
      },
    },
  },
  {
    name: 'get_product',
    description:
      'One product with its description, warranty, stock and customer rating.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Product id from search_products or my_orders.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'my_orders',
    description:
      "The signed-in shopper's own recent orders with their items and delivery status. Answers signedIn: false for a guest.",
  },
  {
    name: 'store_info',
    description:
      'Delivery fee, returns, payment and how to reach a person (phone, email, opening hours).',
  },
];

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toAssistantProduct(product: ProductSummaryResponse): AssistantProduct {
  return {
    id: product.id,
    name: product.name,
    brand: brandOf(product.name),
    price: product.price,
    ...(product.oldPrice !== undefined ? { oldPrice: product.oldPrice } : {}),
    stock: product.stock,
    image: product.image?.trim() || null,
    model: product.model,
  };
}

/** A product as the model sees it. */
function describe(product: ProductSummaryResponse) {
  const { model: _model, ...card } = toAssistantProduct(product);
  return {
    ...card,
    category: product.category,
    ...(product.discountRate > 0
      ? { discountPercent: product.discountRate }
      : {}),
  };
}

/** The tools Rally may call. They only read, through the same services the shop pages use. */
@Injectable()
export class AssistantTools {
  constructor(
    @Inject(ProductListService)
    private readonly productList: ProductListService,
    @Inject(ProductDetailService)
    private readonly productDetail: ProductDetailService,
    @Inject(OrderHistoryService)
    private readonly orderHistory: OrderHistoryService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  contact(): AssistantContact {
    return {
      phone: this.config.get('SUPPORT_PHONE', { infer: true }),
      email: this.config.get('SUPPORT_EMAIL', { infer: true }),
      hours: this.config.get('SUPPORT_HOURS', { infer: true }),
    };
  }

  async run(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (name) {
      case 'search_products':
        return this.searchProducts(args);
      case 'get_product':
        return this.getProduct(args);
      case 'my_orders':
        return this.myOrders(context);
      case 'store_info':
        return this.storeInfo();
      default:
        return { response: { error: 'Unknown tool.' }, products: [] };
    }
  }

  private async searchProducts(
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const notes: string[] = [];

    let categorySlug: string | undefined;
    const category = text(args.category).toLowerCase();
    if (category) {
      const categories = await this.productList.listCategories();
      categorySlug = categories.find(
        (row) => row.slug === category || row.name.toLowerCase() === category,
      )?.slug;
      if (!categorySlug) {
        notes.push(
          `There is no such category, so all were searched. Categories: ${categories.map((row) => row.slug).join(', ')}.`,
        );
      }
    }

    // Only active products come back from the shop's own list.
    let products = await this.productList.listProducts({ categorySlug });

    const brand = text(args.brand).toLowerCase();
    if (brand) {
      products = products.filter((product) =>
        `${product.name.toLowerCase()} `.startsWith(`${brand} `),
      );
    }
    const maxPrice = Number(args.maxPrice);
    if (args.maxPrice !== undefined && Number.isFinite(maxPrice)) {
      products = products.filter((product) => product.price <= maxPrice);
    }
    const { matches, allWords } = bestMatches(
      products,
      text(args.query),
      (product) => `${product.name} ${product.category} ${product.description}`,
    );
    if (!allWords && matches.length > 0) {
      notes.push('No product matches every word; these match the most.');
    }

    const found = matches.slice(0, MAX_SEARCH_RESULTS);
    return {
      response: {
        products: found.map(describe),
        ...(matches.length > found.length
          ? { moreMatches: matches.length - found.length }
          : {}),
        ...(notes.length ? { note: notes.join(' ') } : {}),
      },
      products: found.map(toAssistantProduct),
    };
  }

  private async getProduct(args: Record<string, unknown>): Promise<ToolResult> {
    const id = typeof args.id === 'number' ? String(args.id) : text(args.id);
    const missing = {
      response: { error: 'Product not found.' },
      products: [],
    };
    if (!isDatabaseId(id)) return missing;
    try {
      const product = await this.productDetail.findById(BigInt(id));
      // Review comments are left out: they are other people's text.
      return {
        response: {
          product: {
            ...describe(product),
            description: product.description,
            warranty: product.warranty,
            warrantyStatus: product.warrantyStatus,
            ...(product.reviews > 0
              ? { rating: product.rating, ratingCount: product.reviews }
              : { rating: 'no ratings yet' }),
          },
        },
        products: [toAssistantProduct(product)],
      };
    } catch (error) {
      if (error instanceof NotFoundException) return missing;
      throw error;
    }
  }

  private async myOrders({ customerId }: ToolContext): Promise<ToolResult> {
    if (!customerId) return { response: { signedIn: false }, products: [] };
    const orders = await this.orderHistory.listForUser(customerId);
    return {
      response: {
        signedIn: true,
        totalOrders: orders.length,
        // No order, invoice or line ids: the customer knows an order by its number.
        recentOrders: orders.slice(0, MAX_ORDERS).map((order) => ({
          orderNumber: order.orderNumber,
          orderedOn: order.placedAt.slice(0, 10),
          deliveryStatus: order.status,
          total: order.total,
          items: order.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPricePaid: item.unitPricePaid,
          })),
        })),
      },
      products: [],
    };
  }

  private storeInfo(): ToolResult {
    return {
      response: {
        currency: 'USD',
        shipping: {
          deliveryFee: DELIVERY_FEE_CENTS / 100,
          freeDeliveryForSubtotalFrom: FREE_DELIVERY_FROM_CENTS / 100,
          taxPercent: TAX_PERCENT,
          tracking:
            'The Orders page shows each order as processing, in transit or delivered.',
        },
        returns: {
          window: `${RETURN_WINDOW_DAYS} days after delivery`,
          how: 'Contact the team by phone or email with the order number.',
        },
        payment:
          'Card payment at checkout. This is a demo store: the payment is simulated and no real money is charged.',
        contact: this.contact(),
      },
      products: [],
    };
  }
}
