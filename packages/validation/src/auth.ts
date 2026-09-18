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
