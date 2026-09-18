/**
 * Paisa — INR ka minor unit. ₹12.31 === 1231.
 *
 * Poore stack mein integer paise hi chalta hai. Float mein 0.1 + 0.2 !== 0.3
 * hota hai, aur bill lines exactly reconcile honi chahiye
 * (itemTotal + delivery + tax + platformFee − discount === total).
 */
export type Minor = number;

export const CURRENCY = 'INR' as const;
export type Currency = typeof CURRENCY;

/** Screen [14] ke BILL SUMMARY ka exact shape */
export interface BillBreakdown {
  itemTotalMinor: Minor;
  deliveryFeeMinor: Minor;
  taxMinor: Minor;
  platformFeeMinor: Minor;
  discountMinor: Minor;
  totalMinor: Minor;
  currency: Currency;
}
