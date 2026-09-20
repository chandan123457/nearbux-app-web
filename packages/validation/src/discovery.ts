import { z } from 'zod';
import { cursorPaginationSchema, latitudeSchema, longitudeSchema, uuidSchema } from './primitives.js';
import { COMMERCE } from '@nearbux/core';

/**
 * Screens [1][4] — discovery queries.
 *
 * Coordinates OPTIONAL hain, aur yeh jaan-boojh kar hai. Chhod dene par
 * server user ke DEFAULT ADDRESS ke coordinates use karta hai — jo waise bhi
 * sahi jawab hai, kyunki user ne onboarding mein wahi address diya tha.
 *
 * Pehle client har call par coordinates bhejta tha, aur uske paas asli
 * address aane se pehle ek hardcoded city centre hota tha. Nateeja yeh ki
 * home feed pehle galat shehar ke stores dikhata tha aur phir sahi wale —
 * ya address badalne par bhi purane hi dikhate rehte the. Ab "kahan deliver
 * karna hai" ka ek hi jawab hai, aur woh database mein hai.
 */
export const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().pipe(latitudeSchema).optional(),
  longitude: z.coerce.number().pipe(longitudeSchema).optional(),
  radiusKm: z.coerce.number().min(0.5).max(25).default(COMMERCE.DEFAULT_SEARCH_RADIUS_KM),
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

/** Screen [4] — stores + products dono search hote hain */
export const searchQuerySchema = nearbyQuerySchema.extend({
  q: z.string().trim().min(1, 'Type something to search').max(80),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Screen [5] — in-store catalog: category chips, sort, filter */
export const storeProductsQuerySchema = cursorPaginationSchema.extend({
  categoryId: uuidSchema.optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(['POPULARITY', 'PRICE_LOW_HIGH', 'PRICE_HIGH_LOW', 'RATING']).default('POPULARITY'),
  inStockOnly: z.coerce.boolean().default(false),
});
export type StoreProductsQuery = z.infer<typeof storeProductsQuerySchema>;
