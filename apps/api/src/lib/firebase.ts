import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { isFirebaseConfigured, type Env } from './env.js';
import { Errors } from './errors.js';

/**
 * Phone verification.
 *
 * Hum OTP na banate hain, na bhejte hain, na verify karte hain — woh poora
 * kaam Firebase Phone Auth karta hai. Client se humein ek signed ID token
 * milta hai, aur hum firebase-admin se uska signature verify karke usmein se
 * phone number NIKAALTE hain.
 *
 * Yeh distinction hi puri security hai: client ka bheja hua `phone` field
 * sirf ek claim hai (koi bhi kuch bhi bhej sakta hai), jabki token ke andar
 * ka `phone_number` Firebase ne khud likha hai aur uspar Google ka signature
 * hai. Isliye account hamesha TOKEN wale number par banta hai, body wale
 * number par nahi — aur dono match na karein to request reject hoti hai.
 */
export interface VerifiedPhone {
  /** E.164, Firebase ke signed token se — client ke body se NAHI */
  phone: string;
  /** Firebase UID; dev fallback mein null */
  uid: string | null;
}

export interface PhoneVerifier {
  verify(idToken: string | undefined, claimedPhone: string): Promise<VerifiedPhone>;
}

let app: App | null = null;

function getApp(env: Env): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID!,
      clientEmail: env.FIREBASE_CLIENT_EMAIL!,
      // .env files newlines ko literal "\n" ki tarah rakhti hain. Bina is
      // replace ke key parse hi nahi hoti aur error message ("Invalid PEM
      // formatted message") bilkul nahi batata ki asli wajah kya hai.
      privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
  return app;
}

export function createPhoneVerifier(env: Env, log?: { warn: (msg: string) => void }): PhoneVerifier {
  const configured = isFirebaseConfigured(env);

  if (!configured) {
    /**
     * DEV FALLBACK — Firebase project ke bina bhi poora signup/login flow
     * chalta rehta hai.
     *
     * Yeh har phone number ko bina kisi proof ke accept kar leta hai, isliye
     * production mein yeh raasta possible hi nahi: `loadEnv()` production
     * par Firebase config missing hone par boot hi nahi hone deta.
     */
    if (env.NODE_ENV !== 'test') {
      log?.warn(
        '[auth] Firebase is not configured — phone numbers are accepted WITHOUT verification. Development only.',
      );
    }
    return {
      async verify(_idToken, claimedPhone) {
        return { phone: claimedPhone, uid: null };
      },
    };
  }

  return {
    async verify(idToken, claimedPhone) {
      if (!idToken) {
        throw Errors.badRequest('Phone verification is required');
      }

      let decoded;
      try {
        decoded = await getAuth(getApp(env)).verifyIdToken(idToken);
      } catch {
        // Kyun fail hua (expired, galat project, tampered) yeh client ko
        // batane ka koi fayda nahi — sirf attacker ko feedback milta hai.
        throw Errors.unauthorized('Phone verification failed. Please request a new code.');
      }

      const phone = decoded.phone_number;
      if (!phone) {
        // Email/Google se bana token phone signup ke liye valid nahi hai
        throw Errors.badRequest('This sign-in method cannot verify a phone number');
      }

      if (phone !== claimedPhone) {
        // Ek verified number se doosre number ka account banane ki koshish
        throw Errors.badRequest('Verified number does not match the number you entered');
      }

      return { phone, uid: decoded.uid };
    },
  };
}
