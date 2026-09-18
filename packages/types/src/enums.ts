export const AddressLabel = {
  HOME: 'HOME',
  WORK: 'WORK',
  OTHER: 'OTHER',
} as const;
export type AddressLabel = (typeof AddressLabel)[keyof typeof AddressLabel];

/**
 * Order lifecycle. Tracking screen sirf pehle 4 dikhata hai, lekin
 * notifications OUT_FOR_DELIVERY aur DELIVERED bhi bhejte hain.
 * Order array-index se aage badhta hai — `canTransition()` dekho @nearbux/core.
 */
export const OrderStatus = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** "My Orders" screen ke filter tabs */
export const OrderFilter = {
  ALL: 'ALL',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderFilter = (typeof OrderFilter)[keyof typeof OrderFilter];

export const PaymentMethodType = {
  UPI: 'UPI',
  CARD: 'CARD',
  NETBANKING: 'NETBANKING',
  WALLET: 'WALLET',
  COD: 'COD',
} as const;
export type PaymentMethodType = (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PromotionType = {
  PERCENT_OFF: 'PERCENT_OFF',
  FLAT_OFF: 'FLAT_OFF',
  FREE_DELIVERY: 'FREE_DELIVERY',
} as const;
export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const PromotionScope = {
  PLATFORM: 'PLATFORM',
  STORE: 'STORE',
} as const;
export type PromotionScope = (typeof PromotionScope)[keyof typeof PromotionScope];

export const NotificationType = {
  ORDER_UPDATE: 'ORDER_UPDATE',
  PROMOTION: 'PROMOTION',
  ACCOUNT: 'ACCOUNT',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const CancelledBy = {
  CUSTOMER: 'CUSTOMER',
  STORE: 'STORE',
  SYSTEM: 'SYSTEM',
} as const;
export type CancelledBy = (typeof CancelledBy)[keyof typeof CancelledBy];

export const ProductSort = {
  POPULARITY: 'POPULARITY',
  PRICE_LOW_HIGH: 'PRICE_LOW_HIGH',
  PRICE_HIGH_LOW: 'PRICE_HIGH_LOW',
  RATING: 'RATING',
} as const;
export type ProductSort = (typeof ProductSort)[keyof typeof ProductSort];
