import type { OtpSession } from './phone-auth-core';

/**
 * Do screens ke beech chalne wali OTP state.
 *
 * Yeh in-memory module hai, navigation params NAHI — aur yahi iska poora
 * point hai:
 *
 *  1. **Password kabhi URL mein nahi jaana chahiye.** Expo Router ke params
 *     web par query string ban jaate hain, matlab password address bar,
 *     browser history aur har `Referer` header mein chala jaata. Signup ka
 *     password verify screen tak pahunchna hai, lekin URL se nahi.
 *
 *  2. **`OtpSession` serialize ho hi nahi sakti.** Woh Firebase ka live
 *     confirmation object hold karti hai; use params mein daalna possible
 *     hi nahi.
 *
 * Trade-off: web par page reload karne par yeh state chali jaati hai. Woh
 * theek hai — us halat mein verify screen user ko wapas shuruaat par bhej
 * deti hai, jo ek adhoore signup ke saath aage badhne se behtar hai.
 */
export interface PendingVerification {
  /** Naya account ban raha hai, ya password reset ho raha hai */
  mode: 'signup' | 'reset';
  /** E.164 */
  phone: string;
  /** Firebase ka live confirmation handle */
  session: OtpSession;
  /** mode: 'signup' par hi set hote hain */
  fullName?: string;
  password?: string;
}

/** Reset flow ka doosra hissa: OTP pass ho chuka, ab naya password chahiye */
export interface PendingReset {
  phone: string;
  /** Firebase ka verified ID token; dev mode mein null */
  idToken: string | null;
}

let pendingVerification: PendingVerification | null = null;
let pendingReset: PendingReset | null = null;

export const otpFlow = {
  setVerification(value: PendingVerification) {
    pendingVerification = value;
  },
  getVerification(): PendingVerification | null {
    return pendingVerification;
  },
  /** Session ko replace karta hai ("Resend code" ke baad) */
  replaceSession(session: OtpSession) {
    if (pendingVerification) pendingVerification = { ...pendingVerification, session };
  },
  clearVerification() {
    pendingVerification = null;
  },

  setReset(value: PendingReset) {
    pendingReset = value;
  },
  getReset(): PendingReset | null {
    return pendingReset;
  },
  clearReset() {
    pendingReset = null;
  },
};
