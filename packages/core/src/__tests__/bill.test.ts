import { describe, expect, it } from 'vitest';
import { billReconciles, computeBill } from '../bill.js';
import { discountPercent, formatMinor, percentOfMinor } from '../money.js';

describe('computeBill', () => {
  const lines = [
    { unitPriceMinor: 49900, quantity: 2 }, // Organic Hass Avocados ×2
    { unitPriceMinor: 24900, quantity: 1 }, // Fresh Whole Milk
    { unitPriceMinor: 39900, quantity: 1 }, // Artisan Sourdough Loaf
  ];

  it('quantity ko line total mein count karta hai', () => {
    // Mock screen [7] ne avocado ×2 ko ek hi baar count kiya tha — yeh us bug
    // ke against regression guard hai.
    const bill = computeBill({ lines, deliveryFeeMinor: 3000, promotion: null });
    expect(bill.itemTotalMinor).toBe(49900 * 2 + 24900 + 39900); // ₹1,646.00
  });

  it('har bill hamesha reconcile karta hai', () => {
    const bill = computeBill({ lines, deliveryFeeMinor: 3000, promotion: null });
    expect(billReconciles(bill)).toBe(true);
  });

  it('FLAT_OFF promo apply karta hai aur tax discount ke baad leta hai', () => {
    const bill = computeBill({
      lines,
      deliveryFeeMinor: 3000,
      promotion: { type: 'FLAT_OFF', value: 20000, maxDiscountMinor: null, minOrderMinor: 0 },
    });
    expect(bill.discountMinor).toBe(20000);
    expect(bill.taxMinor).toBe(percentOfMinor(bill.itemTotalMinor - 20000, 500));
    expect(billReconciles(bill)).toBe(true);
  });

  it('PERCENT_OFF ko maxDiscount par cap karta hai', () => {
    const bill = computeBill({
      lines,
      deliveryFeeMinor: 3000,
      promotion: { type: 'PERCENT_OFF', value: 20, maxDiscountMinor: 10000, minOrderMinor: 0 },
    });
    expect(bill.discountMinor).toBe(10000); // 20% = ₹329.20, capped at ₹100
  });

  it('FREE_DELIVERY delivery fee zero karta hai', () => {
    const bill = computeBill({
      lines,
      deliveryFeeMinor: 3000,
      promotion: { type: 'FREE_DELIVERY', value: 0, maxDiscountMinor: null, minOrderMinor: 0 },
    });
    expect(bill.deliveryFeeMinor).toBe(0);
    expect(bill.discountMinor).toBe(0);
  });

  it('minimum order poora na ho to promo reject karta hai', () => {
    const bill = computeBill({
      lines,
      deliveryFeeMinor: 3000,
      promotion: { type: 'FLAT_OFF', value: 20000, maxDiscountMinor: null, minOrderMinor: 500000 },
    });
    expect(bill.discountMinor).toBe(0);
    expect(bill.promotionRejectedReason).toBe('BELOW_MIN_ORDER');
  });

  it('khaali cart par sab zero', () => {
    const bill = computeBill({ lines: [], deliveryFeeMinor: 3000, promotion: null });
    expect(bill.itemTotalMinor).toBe(0);
    expect(bill.platformFeeMinor).toBe(0);
  });
});

describe('money formatting', () => {
  it('Indian digit grouping use karta hai', () => {
    expect(formatMinor(123145)).toBe('₹1,231.45');
    expect(formatMinor(12345678)).toBe('₹1,23,456.78'); // lakh grouping
    expect(formatMinor(74750)).toBe('₹747.50');
  });

  it('MRP se discount percent nikalta hai', () => {
    expect(discountPercent(49900, 64900)).toBe(23); // screen [6] ka "23% OFF"
    expect(discountPercent(49900, null)).toBeNull();
    expect(discountPercent(49900, 40000)).toBeNull(); // MRP price se kam = invalid
  });
});
