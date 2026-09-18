import { z } from 'zod';
import { minorAmountSchema, uuidSchema } from './primitives.js';

/**
 * Screen [8] "Place Order".
 *
 * `expectedTotalMinor` client ka calculated total hai. Server bill dobara
 * compute karta hai aur compare karta hai — mismatch par 409 CONFLICT, taaki
 * user ne jo total dekha wahi charge ho (ya usse dobara confirm karaya jaaye).
 * Yeh AUTHORITATIVE price nahi hai — sirf safety check.
 *
 * `idempotencyKey` client per-checkout-attempt UUID generate karta hai. Network
 * retry par wahi key jaati hai, isliye double order/double charge nahi hota.
 */
export const placeOrderSchema = z.object({
  storeId: uuidSchema,
  addressId: uuidSchema,
  paymentMethodId: uuidSchema.nullable().optional(),
  paymentMethodType: z.enum(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD']),
  expectedTotalMinor: minorAmountSchema,
  idempotencyKey: z.uuid(),
  notes: z.string().trim().max(200).optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

/** Screen [10] "Cancel Order" */
export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Tell us why').max(200),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/** Screen [11] filter tabs */
export const orderListQuerySchema = z.object({
  filter: z.enum(['ALL', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED']).default('ALL'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/** Screen [14] "Rate this Order" — store rating + optional per-product ratings */
export const submitReviewSchema = z.object({
  rating: z.int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  productReviews: z
    .array(
      z.object({
        orderItemId: uuidSchema,
        rating: z.int().min(1).max(5),
        isRecommended: z.boolean(),
        comment: z.string().trim().max(1000).optional(),
      }),
    )
    .max(50)
    .optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
