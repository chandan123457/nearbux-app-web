import Constants from 'expo-constants';

/**
 * Firebase client config.
 *
 * Yeh values PUBLIC hain — woh har user ke bundle mein waise bhi ship hoti
 * hain, aur Firebase ka security model unhe secret maanta hi nahi (asli
 * protection Firebase Auth rules aur App Check se aati hai). Isliye yeh
 * `EXPO_PUBLIC_*` env vars se aati hain.
 *
 * Service account key (FIREBASE_PRIVATE_KEY) kabhi yahan nahi aati — woh
 * sirf server par hai, apps/api mein.
 */
export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

/**
 * Config poori set hai to woh, warna `null`.
 *
 * `null` ka matlab DEV MODE hai: OTP bheja hi nahi jaata aur koi bhi 6-digit
 * code chal jaata hai. Yeh deliberate hai taaki poora signup flow Firebase
 * project ke bina bhi develop aur test ho sake. Server ka bhi wahi rule hai
 * — aur production mein woh Firebase config ke bina boot hi nahi hota,
 * isliye yeh raasta sirf development mein possible hai.
 */
export const firebaseConfig: FirebaseClientConfig | null = (() => {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

  const config = {
    apiKey: extra?.firebaseApiKey,
    authDomain: extra?.firebaseAuthDomain,
    projectId: extra?.firebaseProjectId,
    appId: extra?.firebaseAppId,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    if (__DEV__) {
      console.warn(
        `[auth] Firebase not configured (${missing.join(', ')}). ` +
          'OTP verification is SKIPPED — any 6-digit code will work. Development only.',
      );
    }
    return null;
  }

  return config as FirebaseClientConfig;
})();
