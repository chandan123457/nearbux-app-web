import { z } from 'zod';
import { latitudeSchema, longitudeSchema, pincodeSchema } from './primitives.js';

/** Screen [12] → Saved Addresses */
export const addressSchema = z.object({
  label: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  line1: z.string().trim().min(3, 'Address is too short').max(120),
  line2: z.string().trim().max(120).nullable().optional(),
  landmark: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const updateAddressSchema = addressSchema.partial();
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
