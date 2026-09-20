import { createDevPhoneAuth, type PhoneAuth } from './phone-auth-core';

/**
 * Phone OTP ka platform boundary.
 *
 * Token storage ki tarah, yahan bhi sirf MECHANISM platform ke hisaab se
 * badalta hai — web par Firebase JS SDK + invisible reCAPTCHA, native par
 * Firebase ka native module. Screens ko iska kuch pata nahi chalta: unke
 * liye do hi cheezein hain, `sendOtp()` aur `confirm()`.
 *
 * Metro `.web.ts` / `.native.ts` apne aap chunta hai. Yeh plain file
 * fallback hai — static web build ke Node pre-render pass ke liye, jahan na
 * DOM hai na native modules.
 *
 * Shared types aur dev fallback `phone-auth-core.ts` mein hain, yahan nahi:
 * platform files unhe import karti hain, aur `./phone-auth` unke liye khud
 * par resolve ho jaata hai. Wajah wahan likhi hai.
 */
export type { OtpSession, PhoneAuth } from './phone-auth-core';
export { createDevPhoneAuth } from './phone-auth-core';

export const phoneAuth: PhoneAuth = createDevPhoneAuth();
