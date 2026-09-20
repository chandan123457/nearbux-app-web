import { z } from 'zod';
import { latitudeSchema, longitudeSchema, pincodeSchema } from './primitives.js';

/** Screen [12] → Saved Addresses (poora address form) */
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

/**
 * Screen [4] — "Add your address" (onboarding).
 *
 * Yeh jaan-boojh kar poore address form se ALAG aur halka hai. Us screen par
 * sirf do text fields hain, aur onboarding ke beech mein user se city, state
 * aur pincode type karwana wahi jagah hai jahan sabse zyada log drop karte
 * hain.
 *
 * Isliye: user sirf apna ghar ka address likhta hai, aur baaki sab device ki
 * location se reverse-geocode hokar aata hai.
 *
 * `latitude`/`longitude` hi yahan REQUIRED hain — city ya pincode nahi.
 * Poori discovery (nearby stores, distance sort, delivery radius) sirf
 * coordinates par chalti hai; unke bina home feed khaali rahega. City aur
 * pincode display ke liye hain, query ke liye nahi — isliye woh optional
 * hain aur user baad mein profile se theek kar sakta hai.
 */
export const onboardingAddressSchema = z.object({
  line1: z.string().trim().min(3, 'Please enter your address').max(120),
  line2: z.string().trim().max(120).nullable().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  pincode: pincodeSchema.optional(),
});
export type OnboardingAddressInput = z.infer<typeof onboardingAddressSchema>;
