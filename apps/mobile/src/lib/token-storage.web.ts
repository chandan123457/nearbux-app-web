import type { TokenStorage } from '@nearbux/api-client';

/**
 * Web token storage.
 *
 * TRADE-OFF, jaan lo: `localStorage` ko koi bhi JavaScript padh sakta hai,
 * to ek XSS bug tokens chura sakta hai. Sabse surakshit web design refresh
 * token ko `httpOnly` cookie mein rakhna hai, jise JS padh hi nahi sakta —
 * lekin uske liye backend ko cookie-based auth chahiye aur CSRF protection.
 *
 * Abhi localStorage hai, kyunki API Bearer tokens par chalta hai. Jab web
 * asli users ke saath jayega, yeh upgrade karne layak hai.
 *
 * Har call try/catch mein hai: private browsing, blocked site data, ya
 * thumbnail capture mein accessor throw kar sakta hai. Storage fail hone par
 * app ko crash nahi, sirf signed-out dikhna chahiye.
 */
export const tokenStorage: TokenStorage = {
  async get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage unavailable — session is process ke liye memory mein hi rahegi
    }
  },
  async remove(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
