import { getApp, getApps, initializeApp } from 'firebase/app';
import { RecaptchaVerifier, getAuth, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';
import { createDevPhoneAuth, type OtpSession, type PhoneAuth } from './phone-auth-core';

/**
 * Web phone auth — Firebase JS SDK.
 *
 * Firebase browser mein OTP bhejne se PEHLE reCAPTCHA maangta hai. Yeh
 * optional nahi hai: uske bina `signInWithPhoneNumber` `auth/argument-error`
 * deta hai. Isliye ek invisible verifier banate hain — user ko kuch dikhta
 * nahi jab tak Firebase ko koi request shaqi na lage, tab woh khud challenge
 * dikha deta hai.
 */
function createWebPhoneAuth(): PhoneAuth {
  if (!firebaseConfig) return createDevPhoneAuth();

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  /**
   * reCAPTCHA ko ek asli DOM node chahiye.
   *
   * React Native Web ke andar humare paas koi `<div>` nahi hai jise hum
   * render kar sakein, isliye ek hidden container khud banate hain. Ek hi
   * container reuse hota hai — har OTP par naya banane se Firebase purane
   * widget ko clean nahi karta aur DOM mein orphan iframes jamte rehte hain.
   */
  let verifier: RecaptchaVerifier | null = null;

  function getVerifier(): RecaptchaVerifier {
    if (verifier) return verifier;

    const id = 'nearbux-recaptcha';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
    return verifier;
  }

  return {
    isConfigured: true,
    async sendOtp(phone): Promise<OtpSession> {
      try {
        const confirmation = await signInWithPhoneNumber(auth, phone, getVerifier());
        return {
          async confirm(code) {
            const credential = await confirmation.confirm(code);
            return credential.user.getIdToken();
          },
        };
      } catch (error) {
        // Fail hone par verifier corrupt ho jaata hai — agli koshish usi
        // toote hue widget par chalegi aur hamesha fail karegi. Reset karke
        // error aage bhejte hain taaki "Resend" sach mein kaam kare.
        verifier?.clear();
        verifier = null;
        throw error;
      }
    },
  };
}

export const phoneAuth: PhoneAuth = createWebPhoneAuth();
