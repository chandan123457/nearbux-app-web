/**
 * Platform-wide commerce policy. Ek jagah, taaki web/iOS/Android/server
 * sab same number dikhayein.
 */
export const COMMERCE = {
  /** GST on (itemTotal − discount). Basis points: 500 = 5.00% */
  TAX_RATE_BPS: 500,
  /** Flat platform fee per order — ₹5.00 */
  PLATFORM_FEE_MINOR: 500,
  /** Is radius ke bahar ke stores "Stores Near You" mein nahi aate */
  DEFAULT_SEARCH_RADIUS_KM: 8,
  /** Recent searches chips ki limit (screen [2]) */
  MAX_RECENT_SEARCHES: 10,
  /** Ek cart line par max qty */
  MAX_ITEM_QUANTITY: 20,
  /** ACCEPTED hone ke baad customer khud cancel nahi kar sakta */
  CANCELLABLE_STATUSES: ['PLACED', 'ACCEPTED'] as const,
} as const;
