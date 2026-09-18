/**
 * Platform boundary.
 *
 * Yeh is architecture ka sabse important interface hai: token STORAGE har
 * platform par alag hai (native par Keychain/Keystore via expo-secure-store,
 * web par httpOnly cookie ya localStorage), lekin refresh-rotation ka saara
 * logic — jo asli mushkil part hai — ek hi baar likha jaata hai aur teeno
 * platforms share karte hain.
 *
 * Isi wajah se `@nearbux/api-client` mein ek bhi `Platform.OS` check nahi hai.
 */
export interface TokenStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const TOKEN_KEYS = {
  ACCESS: 'nearbux.accessToken',
  REFRESH: 'nearbux.refreshToken',
} as const;

/** Tests aur SSR pre-render pass ke liye — wahan koi persistent storage nahi hoti */
export function createMemoryTokenStorage(): TokenStorage {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async remove(key) {
      store.delete(key);
    },
  };
}
