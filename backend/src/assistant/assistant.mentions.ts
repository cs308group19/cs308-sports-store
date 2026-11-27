import { brandOf } from './assistant.brands.js';
import type { AssistantProduct } from './assistant.types.js';

/** At most this many product cards under one reply. */
export const MAX_REPLY_PRODUCTS = 4;

/** Words that many product names share, so they cannot identify one. */
const COMMON_WORDS = new Set(
  'men women unisex kids shoe shoes sports sport casual canvas pack of set and the football basketball boots cap socks backpack bag bottle black white grey blue red olive navy maroon purple pink orange gold'.split(
    ' ',
  ),
);

/** Lowercase letters and digits separated by single spaces, with a space at both ends. */
function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

/** The words that tell this product apart: its name without the brand and the common words. */
function distinctiveWords(name: string): string[] {
  const brand = brandOf(name);
  const rest = brand ? name.slice(brand.length) : name;
  return normalize(rest)
    .split(' ')
    .filter((word) => word !== '' && !COMMON_WORDS.has(word));
}

/**
 * Where the reply names the product, or -1. The full name or the model code always counts. A
 * shortened name ("the Gel Cushioning", "the Air Max 2011") counts when it is long enough to point
 * at this product only.
 */
function mentionedAt(
  reply: string,
  product: AssistantProduct,
  others: AssistantProduct[],
): number {
  for (const exact of [product.name, product.model]) {
    const at = reply.indexOf(normalize(exact));
    if (at >= 0) return at;
  }

  const words = distinctiveWords(product.name);
  // One short or plain word is not enough to be sure.
  if (words.length === 0 || words.join('').length < 3) return -1;
  for (
    let length = Math.min(2, words.length);
    length <= words.length;
    length++
  ) {
    const phrase = normalize(words.slice(0, length).join(' '));
    const shared = others.some((other) =>
      normalize(distinctiveWords(other.name).join(' ')).includes(phrase),
    );
    if (!shared) return reply.indexOf(phrase);
  }
  return -1;
}

/** The products from this request's tool results that the reply talks about, in reading order. */
export function mentionedProducts(
  reply: string,
  products: readonly AssistantProduct[],
): AssistantProduct[] {
  const text = normalize(reply);
  return products
    .map((product) => ({
      product,
      at: mentionedAt(
        text,
        product,
        products.filter((other) => other !== product),
      ),
    }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_REPLY_PRODUCTS)
    .map(({ product }) => product);
}
