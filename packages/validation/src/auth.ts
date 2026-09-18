import { z } from 'zod';
import { otpSchema, phoneSchema } from './primitives.js';

/** Screen: phone login. Password nahi hai — profile mein sirf phone dikhta hai. */
export const requestOtpSchema = z.object({
  phone: phoneSchema,
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
  /**
   * Sirf pehli baar (signup) par use hota hai. Pehle yeh yahan tha hi nahi,
   * aur Zod unknown keys strip kar deta hai — isliye naye users ka naam
   * chupchaap gir jaata tha aur sab "NearBux User" ban jaate the.
   */
  fullName: z.string().trim().min(2, 'Name is too short').max(60).optional(),
  /** Push notifications ke liye device register karne hetu */
  deviceToken: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Screen [12]: "Edit" profile */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is too short').max(60),
  email: z.email('Enter a valid email').nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
