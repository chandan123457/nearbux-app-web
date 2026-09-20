import { z } from 'zod';
import { otpSchema, phoneSchema } from './primitives.js';

/**
 * Password rules.
 *
 * Minimum 8 characters, aur kam se kam ek letter + ek digit. Complexity ke
 * aur niyam (symbols, uppercase) deliberately NAHI hain: woh users ko
 * "Password1!" jaise predictable patterns par dhakelte hain aur entropy
 * badhate nahi. Lambai hi asli defence hai.
 *
 * Upper bound 128 hai taaki koi 1 MB ka "password" bhejkar server ko Argon2
 * par busy na kar de — hashing deliberately mehngi hai, aur wahi cheez use
 * ek DoS surface bana deti hai.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

/**
 * Screen [2] — Create your account (SERVER payload).
 *
 * `firebaseIdToken` Firebase Phone Auth se aata hai: OTP client par verify
 * hota hai (SMS Firebase bhejta hai), aur server us token ko firebase-admin
 * se verify karke phone number NIKAALTA hai. Client ka bheja phone number
 * akela kabhi trust nahi hota — warna koi bhi kisi bhi number se account
 * bana leta.
 */
export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is too short').max(60),
  phone: phoneSchema,
  password: passwordSchema,
  firebaseIdToken: z.string().min(1).optional(),
  /** Push notifications ke liye device register karne hetu */
  deviceToken: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Screen [2] ka FORM (client).
 *
 * `confirmPassword` sirf yahan hai, server payload mein nahi — woh ek UI
 * safeguard hai (typo pakadna), authentication ka hissa nahi. Server ko
 * bhejne ka matlab hota ek aisa field validate karna jiska koi security
 * arth hi nahi.
 */
export const signupFormSchema = signupSchema
  .pick({ fullName: true, phone: true, password: true })
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SignupFormInput = z.infer<typeof signupFormSchema>;

/** Screen [1] — Welcome back. OTP nahi, sirf password. */
export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Enter your password'),
  deviceToken: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Screen [1] → "Forgot Password?"
 *
 * Wahi Firebase OTP flow jo signup use karta hai. Purana password nahi
 * maangte — jo user password bhool chuka hai, uske paas woh hai hi nahi;
 * phone ka control hi yahan proof hai.
 */
export const forgotPasswordSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  firebaseIdToken: z.string().min(1).optional(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Signup form par "yeh number pehle se registered hai" check.
 *
 * Yeh jaan-boojh kar ek enumeration trade-off hai: ek attacker isse pata kar
 * sakta hai ki koi number app par hai ya nahi. Alternative yeh hai ki user
 * poora form aur OTP bharne ke BAAD "account already exists" dekhe — jo har
 * asli user ko har baar sataata hai taaki ek aisi baat chhipayi ja sake jo
 * login screen ke timing se waise bhi leak hoti hai. Isliye rate limit iske
 * upar sakht hai.
 */
export const checkPhoneSchema = z.object({ phone: phoneSchema });
export type CheckPhoneInput = z.infer<typeof checkPhoneSchema>;

/** Screen [3] ka 6-digit OTP box — Firebase ko yeh code jaata hai, humein nahi */
export const otpFormSchema = z.object({ code: otpSchema });
export type OtpFormInput = z.infer<typeof otpFormSchema>;

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
