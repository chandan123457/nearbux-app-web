import { z } from 'zod';
import { COMMERCE } from '@nearbux/core';
import { uuidSchema } from './primitives.js';

/** Screen [3][5][6] — "+" button aur quantity stepper */
export const addToCartSchema = z.object({
  productId: uuidSchema,
  quantity: z.int().min(1).max(COMMERCE.MAX_ITEM_QUANTITY),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

/** quantity 0 bhejna = line remove (stepper ko "−" par 1 se 0 le jaana) */
export const updateCartItemSchema = z.object({
  quantity: z.int().min(0).max(COMMERCE.MAX_ITEM_QUANTITY),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/** Screen [7] — promo code box */
export const applyPromotionSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(24)
    .regex(/^[A-Z0-9]+$/, 'Invalid promo code'),
});
export type ApplyPromotionInput = z.infer<typeof applyPromotionSchema>;
