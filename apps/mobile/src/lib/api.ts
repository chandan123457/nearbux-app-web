import Constants from 'expo-constants';
import { createApiClient, createEndpoints } from '@nearbux/api-client';
import { tokenStorage } from './token-storage';

/**
 * API base URL.
 *
 * Phone par `localhost` ka matlab PHONE khud hai, tumhara laptop nahi. Yeh
 * cross-platform dev ki sabse common galti hai: web par sab theek chalta hai,
 * aur physical device par har request fail hoti hai.
 *
 * Resolution order:
 *   1. Ek explicitly set kiya hua non-loopback EXPO_PUBLIC_API_URL — sabse
 *      reliable, aur physical device ke liye yahi recommended hai
 *   2. Expo dev server ka host (`expo start --lan` par LAN IP deta hai)
 *   3. localhost — sirf web aur simulator ke liye kaam karta hai
 */
const API_PORT = 3000;

/** 127.0.0.1 bhi loopback hai, sirf "localhost" check karna kaafi nahi */
function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
}

function resolveBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;

  if (configured) {
    try {
      if (!isLoopback(new URL(configured).hostname)) return configured;
    } catch {
      // Malformed URL — neeche wale raaste par chale jaate hain
    }
  }

  // Expo dev server ka host. `--lan` ke saath yeh LAN IP hota hai, jo phone
  // se reachable hai. Default localhost mode mein yeh loopback hota hai, aur
  // tab device par kuch bhi kaam nahi karega.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && !isLoopback(host)) return `http://${host}:${API_PORT}`;
  }

  return configured ?? `http://localhost:${API_PORT}`;
}

let onUnauthenticated: (() => void) | null = null;

/** Root layout ise register karta hai taaki dead session sign-in par bheje */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler;
}

export const apiClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  storage: tokenStorage,
  onAuthFailure: () => onUnauthenticated?.(),
});

export const api = createEndpoints(apiClient);
export { tokenStorage };
