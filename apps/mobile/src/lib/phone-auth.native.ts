import { firebaseConfig } from './firebase-config';
import { createDevPhoneAuth, type OtpSession, type PhoneAuth } from './phone-auth-core';

/**
 * Native phone auth — iOS / Android.
 *
 * Firebase ka JS SDK yahan phone auth ke liye use NAHI ho sakta: woh
 * reCAPTCHA par depend karta hai, aur React Native mein koi DOM hai hi nahi.
 * Native par Firebase apne native modules se verify karta hai —
 * Android par SafetyNet/Play Integrity, iOS par silent APNs push — aur us
 * raaste par user ko koi captcha dikhta hi nahi.
 *
 * `@react-native-firebase/auth` ek CUSTOM NATIVE MODULE hai, isliye woh Expo
 * Go mein nahi chalta; uske liye ek development build (EAS) chahiye. Isliye
 * yahan use OPTIONALLY load karte hain:
 *
 *   - module mila       → asli OTP
 *   - module nahi mila  → dev fallback (koi SMS nahi, koi bhi 6-digit code)
 *
 * Isse Expo Go par poori app aaj bhi chalti rehti hai, aur dev build banate
 * hi native OTP bina kisi code change ke live ho jaata hai.
 */
function createNativePhoneAuth(): PhoneAuth {
  if (!firebaseConfig) return createDevPhoneAuth();

  let nativeAuth: (() => { signInWithPhoneNumber(phone: string): Promise<NativeConfirmation> }) | null =
    null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeAuth = require('@react-native-firebase/auth').default;
  } catch {
    if (__DEV__) {
      console.warn(
        '[auth] @react-native-firebase/auth is not installed — OTP verification is SKIPPED on this build. ' +
          'Install it and use a development build for real OTP on device.',
      );
    }
    return createDevPhoneAuth();
  }

  return {
    isConfigured: true,
    async sendOtp(phone): Promise<OtpSession> {
      const confirmation = await nativeAuth!().signInWithPhoneNumber(phone);
      return {
        async confirm(code) {
          const credential = await confirmation.confirm(code);
          return credential?.user.getIdToken() ?? null;
        },
      };
    },
  };
}

interface NativeConfirmation {
  confirm(code: string): Promise<{ user: { getIdToken(): Promise<string> } } | null>;
}

export const phoneAuth: PhoneAuth = createNativePhoneAuth();
