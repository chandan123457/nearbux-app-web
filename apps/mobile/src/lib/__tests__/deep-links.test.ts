import { describe, expect, it } from 'vitest';
import { resolveDeepLink } from '../deep-links';

describe('resolveDeepLink', () => {
  it('order links resolve karta hai, order number ya id dono se', () => {
    expect(resolveDeepLink('nearbux://orders/NB-4032')).toBe('/order/NB-4032');
    expect(resolveDeepLink('nearbux://orders/a1b2-c3d4')).toBe('/order/a1b2-c3d4');
  });

  it('store aur product links resolve karta hai', () => {
    expect(resolveDeepLink('nearbux://stores/fresh-valley')).toBe('/store/fresh-valley');
    expect(resolveDeepLink('nearbux://products/abc')).toBe('/product/abc');
  });

  it('scheme ke bina bhi chalta hai', () => {
    expect(resolveDeepLink('orders/NB-1')).toBe('/order/NB-1');
  });

  it('unknown ya adhure links par null deta hai, throw nahi', () => {
    // Purani notifications ke links naye build ke liye anjaan ho sakte hain —
    // us par app crash nahi honi chahiye, bas tap kuch na kare
    expect(resolveDeepLink(null)).toBeNull();
    expect(resolveDeepLink('')).toBeNull();
    expect(resolveDeepLink('nearbux://')).toBeNull();
    expect(resolveDeepLink('nearbux://orders')).toBeNull();
    expect(resolveDeepLink('nearbux://unknown/thing')).toBeNull();
  });
});
