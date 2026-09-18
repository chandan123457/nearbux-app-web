import type { BillBreakdown, Minor, PromotionType } from '@nearbux/types';
import { COMMERCE } from './config.js';
import { percentOfMinor } from './money.js';

export interface BillInput {
  lines: Array<{ unitPriceMinor: Minor; quantity: number }>;
  deliveryFeeMinor: Minor;
  promotion?: {
    type: PromotionType;
    /** PERCENT_OFF: percent (20) | FLAT_OFF: minor units */
    value: number;
    maxDiscountMinor: Minor | null;
    minOrderMinor: Minor;
  } | null;
}

export interface BillResult extends BillBreakdown {
  /** Promo apply nahi hua to kyun — UI isse message dikhata hai */
  promotionRejectedReason: 'BELOW_MIN_ORDER' | null;
}

/**
 * Bill ka SINGLE source of truth.
 *
 * Client isse preview dikhane ke liye chalata hai, server isse authoritative
 * total nikalne ke liye. `POST /orders` par server dobara compute karta hai
 * aur client ke bheje total se match karta hai — mismatch par 409.
 * Client ka bheja hua price kabhi trust nahi karna.
 */
export function computeBill(input: BillInput): BillResult {
  const itemTotalMinor = input.lines.reduce(
    (sum, l) => sum + l.unitPriceMinor * l.quantity,
    0,
  );

  let discountMinor = 0;
  let deliveryFeeMinor = input.deliveryFeeMinor;
  let promotionRejectedReason: BillResult['promotionRejectedReason'] = null;

  const promo = input.promotion;
  if (promo) {
    if (itemTotalMinor < promo.minOrderMinor) {
      promotionRejectedReason = 'BELOW_MIN_ORDER';
    } else {
      switch (promo.type) {
        case 'PERCENT_OFF': {
          const raw = percentOfMinor(itemTotalMinor, promo.value * 100);
          discountMinor = promo.maxDiscountMinor ? Math.min(raw, promo.maxDiscountMinor) : raw;
          break;
        }
        case 'FLAT_OFF':
          discountMinor = Math.min(promo.value, itemTotalMinor);
          break;
        case 'FREE_DELIVERY':
          deliveryFeeMinor = 0;
          break;
      }
    }
  }

  // Tax discounted subtotal par lagta hai — customer ko tax nahi dena chahiye
  // us amount par jo usne pay hi nahi kiya.
  const taxableMinor = Math.max(0, itemTotalMinor - discountMinor);
  const taxMinor = percentOfMinor(taxableMinor, COMMERCE.TAX_RATE_BPS);
  const platformFeeMinor = itemTotalMinor > 0 ? COMMERCE.PLATFORM_FEE_MINOR : 0;

  const totalMinor = Math.max(
    0,
    itemTotalMinor + deliveryFeeMinor + taxMinor + platformFeeMinor - discountMinor,
  );

  return {
    itemTotalMinor,
    deliveryFeeMinor,
    taxMinor,
    platformFeeMinor,
    discountMinor,
    totalMinor,
    currency: 'INR',
    promotionRejectedReason,
  };
}

/** Invariant check — receipt kabhi mismatch na dikhaye */
export function billReconciles(bill: BillBreakdown): boolean {
  return (
    bill.itemTotalMinor +
      bill.deliveryFeeMinor +
      bill.taxMinor +
      bill.platformFeeMinor -
      bill.discountMinor ===
    bill.totalMinor
  );
}
