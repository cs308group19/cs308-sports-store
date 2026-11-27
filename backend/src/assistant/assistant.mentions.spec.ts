import { SEED_PRODUCTS } from '../scripts/catalogue-seed.data.js';
import { brandOf } from './assistant.brands.js';
import { mentionedProducts } from './assistant.mentions.js';
import type { AssistantProduct } from './assistant.types.js';

/** SCRUM-113. Only the products a reply really talks about become cards. */
describe('mentionedProducts', () => {
  const catalogue: AssistantProduct[] = SEED_PRODUCTS.map((seed, index) => ({
    id: index + 1,
    name: seed.name,
    brand: brandOf(seed.name),
    price: seed.price,
    stock: seed.stock,
    image: null,
    model: seed.model,
  }));
  const mentioned = (reply: string, from = catalogue) =>
    mentionedProducts(reply, from).map((product) => product.model);

  it('finds every seeded product by its full name', () => {
    for (const product of catalogue) {
      expect(mentioned(`Try the ${product.name}!`)).toContain(product.model);
    }
  });

  it('keeps the reading order and ignores punctuation and case', () => {
    expect(
      mentioned(
        'The new balance MR310 women cushioning grey/purple shoe, or the Puma Unisex White Cap.',
      ),
    ).toEqual(['NB-MR310-GPR', 'PM-CAP-WHT']);
  });

  it('finds a shortened name that points at one product', () => {
    expect(
      mentioned('The Gel Cushioning is softer than the Air Max 2011.'),
    ).toEqual(['AS-GELC-WPK', 'NK-AM11-GRY']);
  });

  it('does not guess between two products that share the short name', () => {
    expect(mentioned('We have a couple of Air Max pairs.')).toEqual([]);
  });

  it('finds nothing in a reply without product names', () => {
    expect(
      mentioned(
        'What sport are you playing, and what is your budget for new running shoes or a football?',
      ),
    ).toEqual([]);
  });

  it('only picks from the products the tools returned', () => {
    expect(mentioned('Try the Puma Unisex White Cap.', [])).toEqual([]);
  });

  it('sends at most four cards', () => {
    expect(
      mentioned(catalogue.map((product) => product.name).join(', ')),
    ).toHaveLength(4);
  });
});
