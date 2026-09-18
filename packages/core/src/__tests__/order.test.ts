import { describe, expect, it } from 'vitest';
import {
  buildItemPreview,
  canCustomerCancel,
  canTransition,
  formatOrderNumber,
  isInProgress,
  statusesForFilter,
} from '../order.js';
import { initials } from '../format.js';

describe('order lifecycle', () => {
  it('sirf forward transitions allow karta hai', () => {
    expect(canTransition('PLACED', 'ACCEPTED')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('PLACED', 'DELIVERED')).toBe(false); // illegal jump
    expect(canTransition('DELIVERED', 'PREPARING')).toBe(false);
    expect(canTransition('CANCELLED', 'ACCEPTED')).toBe(false);
  });

  it('out-for-delivery ke baad cancel nahi hota', () => {
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED')).toBe(false);
    expect(canCustomerCancel('PLACED')).toBe(true);
    expect(canCustomerCancel('PREPARING')).toBe(false);
  });

  it('in-progress statuses ko pehchanta hai', () => {
    expect(isInProgress('PREPARING')).toBe(true);
    expect(isInProgress('DELIVERED')).toBe(false);
    expect(isInProgress('CANCELLED')).toBe(false);
  });

  it('filter tabs ko statuses par map karta hai', () => {
    expect(statusesForFilter('ALL')).toBeNull();
    expect(statusesForFilter('IN_PROGRESS')).toContain('PREPARING');
    expect(statusesForFilter('DELIVERED')).toEqual(['DELIVERED']);
  });
});

describe('display helpers', () => {
  it('item preview banata hai', () => {
    expect(buildItemPreview(['Avocados', 'Milk', 'Sourdough'])).toBe('Avocados, Milk, Sourdough');
    expect(buildItemPreview(['Greek Yogurt', 'Granola', 'Honey', 'Oats'], 2)).toBe(
      'Greek Yogurt, Granola +2 more',
    );
  });

  it('order number format', () => {
    expect(formatOrderNumber(4032)).toBe('NB-4032');
  });

  it('initials nikalta hai', () => {
    expect(initials('Rahul Sharma')).toBe('RS');
    expect(initials('Fresh Valley Supermarket')).toBe('FV');
    expect(initials('FreshMart')).toBe('FR');
  });
});
