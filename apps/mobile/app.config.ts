import type { ExpoConfig } from 'expo/config';

/**
 * TypeScript config isliye (app.json nahi) taaki environment build ko drive
 * kar sake: dev/preview/production alag naam aur bundle id ke saath ek hi
 * device par saath-saath install ho sakte hain.
 */
const variant = process.env.APP_VARIANT ?? 'development';
const isProduction = variant === 'production';

const name = isProduction ? 'NearBux' : `NearBux (${variant})`;
const bundleId = isProduction ? 'com.nearbux.app' : `com.nearbux.app.${variant}`;

const config: ExpoConfig = {
  name,
  slug: 'nearbux',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'nearbux',
  userInterfaceStyle: 'light',
  // New Architecture SDK 55+ par default aur only option hai — flag hata
  // diya gaya hai

  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
  },
  android: {
    // SDK 54+ par edge-to-edge default aur mandatory hai, isliye koi flag
    // nahi — safe area handling react-native-safe-area-context sambhalta hai
    package: bundleId,
  },
  web: {
    bundler: 'metro',
    // Static rendering — har route build time par HTML banta hai.
    // Yeh Expo web ka sabse behtar SEO aur first-paint option hai; full
    // per-request SSR SDK 57 mein abhi alpha hai.
    output: 'static',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        // Screen [4] — address screen city/state/pincode aur coordinates isi
        // se bharta hai. Permission string saaf hona chahiye: App Store
        // review generic "we need your location" reject karta hai.
        locationAlwaysAndWhenInUsePermission:
          'NearBux uses your location to find stores that deliver to your address.',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    // EXPO_PUBLIC_* bundle mein INLINE hota hai aur har user ke device par
    // ship hota hai. Sirf public values — kabhi koi secret nahi.
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    variant,

    // Firebase client config — phone OTP ke liye. Yeh values public hain
    // (Firebase inhe secret maanta hi nahi); service account key server par
    // rehti hai, yahan kabhi nahi. Missing hone par app dev mode mein chalti
    // hai: koi SMS nahi, koi bhi 6-digit code chalta hai.
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
};

export default config;
