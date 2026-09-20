import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductCard } from '../components/ProductCard.js';
import { StoreCard } from '../components/StoreCard.js';

/**
 * Nested interactive controls ke against guard.
 *
 * react-native-web ek `Pressable` ko `accessibilityRole="button"` ke saath
 * asli <button> element banata hai. Ek ko dusre ke andar rakhne par browser
 * console error deta hai ("<button> cannot contain a nested <button>"),
 * DOM ko silently restructure kar deta hai, aur screen readers nested
 * controls announce karte hain.
 *
 * Yeh native par bilkul nahi dikhta — wahan nesting legal hai. Isliye is
 * bug ka sirf ek hi reliable detector hai: components ko DOM par render
 * karke dekho.
 */
function countNestedButtons(html: string): number {
  let depth = 0;
  let nested = 0;

  for (const match of html.matchAll(/<button\b|<\/button>/g)) {
    if (match[0] === '</button>') {
      depth -= 1;
    } else {
      if (depth > 0) nested += 1;
      depth += 1;
    }
  }
  return nested;
}

describe('countNestedButtons', () => {
  it('sirf nesting pakadta hai, adjacent buttons nahi', () => {
    expect(countNestedButtons('<button>a</button><button>b</button>')).toBe(0);
    expect(countNestedButtons('<button>a<button>b</button></button>')).toBe(1);
    expect(countNestedButtons('<div><button>a</button></div>')).toBe(0);
  });
});

describe('StoreCard', () => {
  const props = {
    name: 'Fresh Valley Supermarket',
    tagline: 'Groceries & Daily Essentials',
    coverUrl: null,
    logoUrl: null,
    rating: 4.8,
    distanceLabel: '1.2 km',
    etaLabel: '15-20 min',
    isOpen: true,
    opensAtLabel: null,
    deliveryFeeLabel: null,
    isFavorite: false,
    onToggleFavorite: () => {},
    onPress: () => {},
  };

  it('favourite heart ko card ke andar nest nahi karta', () => {
    const html = renderToStaticMarkup(<StoreCard {...props} />);
    expect(countNestedButtons(html)).toBe(0);
  });

  it('card aur heart, dono alag-alag controls rehte hain', () => {
    const html = renderToStaticMarkup(<StoreCard {...props} />);
    // Ek card ke liye, ek heart ke liye
    expect(html.match(/<button\b/g)?.length).toBe(2);
  });
});

describe('ProductCard', () => {
  const props = {
    name: 'Organic Hass Avocados',
    unitLabel: '2 pcs pack',
    priceLabel: '₹499.00',
    imageUrl: null,
    isAvailable: true,
    isFavorite: false,
    onToggleFavorite: () => {},
    cartQuantity: 0,
    onChangeQuantity: () => {},
    onPress: () => {},
  };

  it('heart aur add button ko card ke andar nest nahi karta', () => {
    const html = renderToStaticMarkup(<ProductCard {...props} />);
    expect(countNestedButtons(html)).toBe(0);
  });

  it('cart mein hone par stepper ke saath bhi nesting nahi', () => {
    const html = renderToStaticMarkup(<ProductCard {...props} cartQuantity={2} />);
    expect(countNestedButtons(html)).toBe(0);
  });

  it('favourite toggle na hone par bhi clean rehta hai', () => {
    const html = renderToStaticMarkup(
      <ProductCard {...props} onToggleFavorite={undefined} />,
    );
    expect(countNestedButtons(html)).toBe(0);
  });
});
