/**
 * Phone OTP ka platform-independent core.
 *
 * Yeh file JAAN-BOOJH KAR `phone-auth.ts` se alag hai, aur uski wajah Metro
 * ka platform resolution hai:
 *
 *   `./phone-auth` web par `phone-auth.web.ts` par resolve hota hai.
 *
 * Matlab agar `phone-auth.web.ts` `./phone-auth` se kuch import kare, to woh
 * KHUD KO import karti hai — ek circular import jisme saare exports
 * `undefined` aate hain. Runtime par woh aise dikhta hai:
 *
 *   (0 , _phoneAuth.createDevPhoneAuth) is not a function
 *
 * Bundler isse pakadta nahi, kyunki file technically exist karti hai.
 * Isliye shared types aur shared implementation yahan rehte hain — ek aisi
 * file mein jiska koi platform variant nahi hai, bilkul jaise
 * `token-storage.web.ts` apna `TokenStorage` type `@nearbux/api-client` se
 * leta hai, `./token-storage` se nahi.
 */

export interface OtpSession {
  /**
   * Code verify karta hai aur Firebase ka signed ID token deta hai.
   *
   * Dev mode mein `null` aata hai: tab server bhi Firebase ke bina chal raha
   * hota hai aur token ke bina hi phone accept karta hai.
   */
  confirm(code: string): Promise<string | null>;
}

export interface PhoneAuth {
  /** Firebase configured hai? `false` = dev mode, koi asli SMS nahi jaata. */
  readonly isConfigured: boolean;
  sendOtp(phone: string): Promise<OtpSession>;
}

/**
 * Dev fallback — koi SMS nahi, koi verification nahi.
 *
 * Har platform file iske paas gir sakti hai (config missing, ya native
 * module install nahi hai), isliye yeh ek hi jagah likha hai.
 */
export function createDevPhoneAuth(): PhoneAuth {
  return {
    isConfigured: false,
    async sendOtp(phone) {
      if (__DEV__) console.log(`[auth] dev mode — no SMS sent to ${phone}, any 6-digit code works`);
      return {
        async confirm() {
          return null;
        },
      };
    },
  };
}
