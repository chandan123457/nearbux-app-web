import type { z } from 'zod';
import { Errors } from './errors.js';

/**
 * Zod schema se request parse karta hai; fail par typed 400 phenkta hai.
 *
 * Yahan fastify-type-provider-zod jaisi koi library deliberately use nahi ki.
 * Yeh helper 15 lines ka hai, dependency-free hai, aur schema wahi hai jo
 * client form validation ke liye use hota hai (@nearbux/validation).
 */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw Errors.badRequest(
      'Validation failed',
      result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    );
  }
  return result.data;
}
