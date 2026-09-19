import { describe, expect, it } from 'vitest';
import {
  buildItemPreview,
  canCustomerCancel,
  canTransition,
  formatOrderNumber,
  isInProgress,
  statusesForFilter,
} from '../order.js';
import { formatDate, formatTime, initials } from '../format.js';

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

  /**
   * Yeh strings teeno platforms par ek jaisi honi chahiye.
   *
   * Intl ka month naam ICU version par depend karta hai — kuch platforms
   * September ko "Sept" dete hain, kuch "Sep". Designs "Sep" dikhati hain,
   * aur server ka render client se match hona chahiye.
   */
  it('date ko chhote month naam se format karta hai, ICU se nahi', () => {
    expect(formatDate(new Date('2026-09-10T06:00:00Z'))).toBe('10 Sep');
    expect(formatDate(new Date('2026-01-05T06:00:00Z'))).toBe('05 Jan');
    expect(formatDate(new Date('2026-12-31T06:00:00Z'))).toBe('31 Dec');
  });

  it('time ko uppercase AM/PM ke saath IST mein format karta hai', () => {
    // 08:40 UTC = 14:10 IST
    expect(formatTime(new Date('2026-09-10T08:40:00Z'))).toBe('2:10 PM');
    // 06:00 UTC = 11:30 IST
    expect(formatTime(new Date('2026-09-10T06:00:00Z'))).toBe('11:30 AM');
    // 18:30 UTC = 00:00 IST agle din — midnight 12 AM hona chahiye, 0 nahi
    expect(formatTime(new Date('2026-09-10T18:30:00Z'))).toBe('12:00 AM');
    // 06:30 UTC = 12:00 IST — dopahar 12 PM hona chahiye
    expect(formatTime(new Date('2026-09-10T06:30:00Z'))).toBe('12:00 PM');
  });

  it('initials nikalta hai', () => {
    expect(initials('Rahul Sharma')).toBe('RS');
    expect(initials('Fresh Valley Supermarket')).toBe('FV');
    expect(initials('FreshMart')).toBe('FR');
  });
});
