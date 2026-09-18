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

  plugins: ['expo-router', 'expo-secure-store'],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    // EXPO_PUBLIC_* bundle mein INLINE hota hai aur har user ke device par
    // ship hota hai. Sirf public values — kabhi koi secret nahi.
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    variant,
  },
};

export default config;
