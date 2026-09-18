import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from '@nearbux/api-client';

/**
 * Native token storage — iOS Keychain / Android Keystore.
 *
 * Yeh OS-level encrypted storage hai. Device chori hone par bhi tokens
 * nikalna mushkil hai, aur AsyncStorage ke ulta yeh backups mein plaintext
 * nahi jaata.
 *
 * Metro `.native.ts` ko iOS aur Android par apne aap chunta hai, `.web.ts`
 * ko browser par. Caller ko pata bhi nahi chalta — dekho token-storage.ts
 */
export const tokenStorage: TokenStorage = {
  async get(key) {
    return SecureStore.getItemAsync(key);
  },
  async set(key, value) {
    await SecureStore.setItemAsync(key, value, {
      // Device unlock hone ke baad hi accessible — background refresh ke liye
      // kaafi hai, aur locked device se padha nahi ja sakta
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async remove(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
